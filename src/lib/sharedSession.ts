/**
 * One sign-in across every AutoSolutions app.
 *
 * Supabase keeps the session in localStorage, which browsers scope to a single
 * origin. The hub (autosolutions.app) and the apps (design-studio.autosolutions.app,
 * e-sales.autosolutions.app…) are different origins, so a session created in
 * one is invisible to the others — which is why signing in at the hub and then
 * opening an app asked for a second sign-in.
 *
 * Cookies can be scoped to a parent domain, so the session is mirrored into a
 * cookie on .autosolutions.app that every app can read. Each app still uses its
 * own localStorage as the working copy; this only keeps them in step.
 *
 * Off that domain — localhost, *.lovable.app previews — nothing changes.
 *
 * Note for whoever wires this into another app: import and CALL it. A bare
 * `import "./sharedSession"` is removed by the bundler in any package marked
 * "sideEffects": false, and the build still succeeds — it just ships nothing.
 */

const PARENT_DOMAIN = "autosolutions.app";
/** Cookies cap around 4KB; sessions can exceed that, so they are chunked. */
const CHUNK = 3200;
const MAX_CHUNKS = 8;

/**
 * supabase-js derives this key from the project ref in the URL the client was
 * built with, so the ref is passed in rather than pinned here — a pinned copy
 * can drift from the configured URL and silently read nothing.
 */
function storageKey(projectRef: string): string {
  return `sb-${projectRef}-auth-token`;
}

function sharingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === PARENT_DOMAIN || host.endsWith(`.${PARENT_DOMAIN}`);
}

function readCookieChunks(key: string): string | null {
  const jar = document.cookie ? document.cookie.split("; ") : [];
  const found = new Map<number, string>();
  for (const entry of jar) {
    const index = entry.indexOf("=");
    if (index < 0) continue;
    const name = entry.slice(0, index);
    if (!name.startsWith(`${key}.`)) continue;
    const part = Number(name.slice(key.length + 1));
    if (Number.isInteger(part)) found.set(part, entry.slice(index + 1));
  }
  if (found.size === 0) return null;
  let value = "";
  for (let i = 0; i < found.size; i += 1) {
    const part = found.get(i);
    if (part === undefined) return null; // a chunk is missing: treat as absent
    value += part;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function writeCookieChunks(key: string, value: string): void {
  const encoded = encodeURIComponent(value);
  const parts: string[] = [];
  for (let i = 0; i < encoded.length; i += CHUNK) parts.push(encoded.slice(i, i + CHUNK));
  if (parts.length > MAX_CHUNKS) return; // implausibly large; leave the cookie alone

  const attributes = `Domain=.${PARENT_DOMAIN}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;
  parts.forEach((part, index) => {
    document.cookie = `${key}.${index}=${part}; ${attributes}`;
  });
  // clear any leftovers from a previously longer session
  for (let index = parts.length; index < MAX_CHUNKS; index += 1) {
    document.cookie = `${key}.${index}=; Domain=.${PARENT_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  }
}

function clearCookieChunks(key: string): void {
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    document.cookie = `${key}.${index}=; Domain=.${PARENT_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  }
}

/**
 * Copy a session that arrived from another app into this origin's storage.
 * Must run before the Supabase client reads its storage, so call it at module
 * scope from the app's entry point.
 */
export function adoptSharedSession(projectRef: string): void {
  if (!sharingEnabled()) return;
  const key = storageKey(projectRef);
  try {
    const local = window.localStorage.getItem(key);
    const shared = readCookieChunks(key);
    if (shared && !local) {
      window.localStorage.setItem(key, shared);
    } else if (local && local !== shared) {
      writeCookieChunks(key, local);
    }
  } catch {
    // Storage unavailable (private mode, blocked cookies): fall back to a
    // normal per-app sign-in rather than breaking the page.
  }
}

/** Keep the shared cookie in step with this app's session. */
export function publishSessionChanges(
  client: {
    auth: { onAuthStateChange: (cb: (event: string) => void) => unknown };
  },
  projectRef: string,
): void {
  if (!sharingEnabled()) return;
  const key = storageKey(projectRef);
  try {
    client.auth.onAuthStateChange((event) => {
      // Only an explicit sign-out may tear down single sign-on. An absent
      // local session (INITIAL_SESSION on load, storage drift) is not evidence.
      if (event === "SIGNED_OUT") {
        clearCookieChunks(key);
        return;
      }
      const local = window.localStorage.getItem(key);
      if (local) writeCookieChunks(key, local);
    });
  } catch {
    // Never let session mirroring break authentication itself.
  }
}
