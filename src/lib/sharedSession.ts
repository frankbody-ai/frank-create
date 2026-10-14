/**
 * The copy of the shared-session code for apps that build their own Supabase
 * client instead of calling createOsClient.
 *
 * It is autosolutions-os 0.2.6's src/session.ts, unchanged, plus the helpers
 * these apps import from it (projectRefFromUrl, sharedSessionStorageKey and the
 * server half, readSharedSessionCookie and readSharedAccessToken). Change the
 * package first and regenerate this file (plans/sso/make-canonical.mjs) rather
 * than editing a copy, so the apps cannot drift apart again.
 *
 * Wire it up where the client is created, in this order, at module scope:
 *
 *   adoptSharedSession(ref);                 // before createClient reads storage
 *   const supabase = createClient(...);
 *   publishSessionChanges(supabase, ref);
 *   followSharedSession(supabase, ref);      // new in 0.2.5
 *
 * Import and CALL them. A bare `import "./sharedSession"` is removed by the
 * bundler in any package marked "sideEffects": false, and the build still
 * succeeds: it just ships nothing.
 */

/**
 * One sign-in across every AutoSolutions app.
 *
 * Supabase keeps the session in localStorage, which browsers scope to a single
 * origin. The hub (autosolutions.app) and the apps (design-studio.autosolutions.app,
 * e-crm.autosolutions.app…) are different origins, so a session created in one is
 * invisible to the others. Cookies can be scoped to a parent domain, so the
 * session is mirrored into a cookie on .autosolutions.app that every app reads.
 * Each app still uses its own localStorage as the working copy; this keeps them
 * in step.
 *
 * Off that domain (localhost, preview hosts) nothing happens and each app
 * signs in normally.
 *
 * The rules that matter:
 *
 * 1. The newest copy wins. Supabase rotates refresh tokens: a refresh retires
 *    the token it used, and a retired token used again is accepted only one
 *    step behind or within 10 seconds. Anything older is taken as theft and
 *    ends the session for every app at once. So an app must never refresh with
 *    a copy older than the shared one. Wherever the two copies meet (on load,
 *    when a tab comes back to focus or into view, and whenever supabase-js reads
 *    its session, which it does before every refresh), the one that expires
 *    later is kept; on a tie, the shared one. While the page's own refresh is
 *    in flight, a newer copy of the same person waits for the next read, as
 *    supabase-js throws a refresh away when its copy changes under it. Until
 *    0.2.5 the app's own copy always won, so an app opened after the Hub had
 *    refreshed refreshed with a retired token, was signed out, and took the
 *    Hub's session with it.
 * 2. Only an explicit sign-out (`client.auth.signOut()`) clears the shared
 *    session, and it clears it everywhere: it leaves a note in the cookie jar
 *    so every app drops any copy at least as old as the one signed out, or of
 *    a session it ended, rather than putting it back. A missing local session,
 *    a failed refresh or blocked storage clears nothing.
 * 3. A different person signing in elsewhere replaces the session here. A page
 *    that was showing someone else reloads, and so does a page on its sign-in
 *    screen when a session arrives, so it shows that person.
 * 4. Storage or cookie errors never break sign-in: each app then simply signs
 *    in on its own.
 */

const PARENT_DOMAIN = "autosolutions.app";

/** Cookies cap around 4KB each, and sessions can exceed that, so they chunk. */
const CHUNK = 3200;
const MAX_CHUNKS = 8;
const MAX_AGE = 60 * 60 * 24 * 30;

function storageKey(projectRef: string): string {
  return `sb-${projectRef}-auth-token`;
}

/** The note an explicit sign-out leaves: copies expiring at or before its watermark, or of a session it names, are signed out. */
function signedOutName(key: string): string {
  return `${key}-signed-out`;
}

function sharingEnabled(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const host = window.location.hostname;
  return host === PARENT_DOMAIN || host.endsWith(`.${PARENT_DOMAIN}`);
}

/** Reassemble a chunked value from any source of name/value pairs. */
export function joinChunks(key: string, read: (name: string) => string | undefined): string | null {
  const parts: string[] = [];
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const part = read(`${key}.${index}`);
    if (part === undefined) break;
    parts.push(part);
  }
  if (parts.length === 0) return null;
  try {
    return decodeURIComponent(parts.join(""));
  } catch {
    return null;
  }
}

function cookieJar(): Map<string, string> {
  const jar = new Map<string, string>();
  for (const entry of document.cookie ? document.cookie.split("; ") : []) {
    const index = entry.indexOf("=");
    if (index > 0) jar.set(entry.slice(0, index), entry.slice(index + 1));
  }
  return jar;
}

function writeCookieChunks(key: string, value: string): void {
  const encoded = encodeURIComponent(value);
  const parts: string[] = [];
  for (let i = 0; i < encoded.length; i += CHUNK) parts.push(encoded.slice(i, i + CHUNK));
  if (parts.length > MAX_CHUNKS) return; // implausibly large: leave the cookie alone

  const attributes = `Domain=.${PARENT_DOMAIN}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`;
  parts.forEach((part, index) => {
    document.cookie = `${key}.${index}=${part}; ${attributes}`;
  });
  // Clear leftovers from a previously longer session.
  for (let index = parts.length; index < MAX_CHUNKS; index += 1) {
    document.cookie = `${key}.${index}=; Domain=.${PARENT_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  }
}

function clearCookieChunks(key: string): void {
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    document.cookie = `${key}.${index}=; Domain=.${PARENT_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  }
}

type SignedOut = { expiresAt: number; sessions: string[] };

function readSignedOut(jar: Map<string, string>, key: string): SignedOut | null {
  const raw = jar.get(signedOutName(key));
  if (raw === undefined || raw === "") return null;
  const [watermark = "", sessions = ""] = raw.split("|");
  const expiresAt = Number(watermark);
  if (!Number.isFinite(expiresAt)) return null;
  return { expiresAt, sessions: sessions ? sessions.split(".") : [] };
}

function writeSignedOut(key: string, expiresAt: number, sessionIds: string[]): void {
  const prior = readSignedOut(cookieJar(), key);
  const watermark = prior === null ? expiresAt : Math.max(prior.expiresAt, expiresAt);
  const sessions = [...new Set([...(prior?.sessions ?? []), ...sessionIds])].slice(-8);
  const value = sessions.length > 0 ? `${watermark}|${sessions.join(".")}` : `${watermark}`;
  document.cookie = `${signedOutName(key)}=${value}; Domain=.${PARENT_DOMAIN}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`;
}

/** A copy the sign-out ended: it expires no later than the sign-out's watermark, or it is one of the sessions it ended (a refresh of that session expires later). */
function signedOutCopy(copy: Copy, note: SignedOut | null): boolean {
  if (note === null) return false;
  return copy.expiresAt <= note.expiresAt || (copy.sessionId !== null && note.sessions.includes(copy.sessionId));
}

/** What the rules need from a stored session, or null when it is not one. */
type Copy = { raw: string; expiresAt: number; refreshToken: string; userId: string | null; sessionId: string | null };

/** The `session_id` claim of an access token: one sign-in keeps it through every refresh. */
function sessionIdOf(accessToken: string): string | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { session_id?: unknown };
    return typeof claims.session_id === "string" && claims.session_id.length > 0 ? claims.session_id : null;
  } catch {
    return null;
  }
}

function parseCopy(raw: string | null | undefined): Copy | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as { access_token?: unknown; refresh_token?: unknown; expires_at?: unknown; user?: unknown };
    if (typeof session.access_token !== "string" || typeof session.refresh_token !== "string") return null;
    const expiresAt = Number(session.expires_at);
    if (!Number.isFinite(expiresAt)) return null;
    const user = session.user as { id?: unknown } | null | undefined;
    return {
      raw,
      expiresAt,
      refreshToken: session.refresh_token,
      userId: typeof user?.id === "string" ? user.id : null,
      sessionId: sessionIdOf(session.access_token),
    };
  } catch {
    return null;
  }
}

/**
 * The shared copy. "unreadable" is a cookie that is there but does not parse,
 * such as one read while another app is halfway through writing its chunks:
 * that is not the same as no shared session, so nothing acts on it.
 */
type Shared = { state: "absent" } | { state: "unreadable" } | { state: "present"; copy: Copy };

function readShared(jar: Map<string, string>, key: string): Shared {
  if (!jar.has(`${key}.0`)) return { state: "absent" };
  const copy = parseCopy(joinChunks(key, (name) => jar.get(name)));
  return copy ? { state: "present", copy } : { state: "unreadable" };
}

/** What one page knows, per storage key. One module instance serves one page. */
type Page = {
  /** Refresh tokens this page saw fail or sign out: never taken back from the cookie. */
  dead: Set<string>;
  /** Whom the page shows, from the last auth event: undefined until the first. */
  user: string | null | undefined;
  /** followSharedSession is installed: sign-out is explicit only through client.auth.signOut. */
  following: boolean;
  signingOut: boolean;
  reloading: boolean;
  /** Whether supabase-js has a token request in flight (followSharedSession sets it). */
  refreshing: () => boolean;
};

const pages = new WeakMap<object, Map<string, Page>>();

function pageFor(key: string): Page {
  let byKey = pages.get(window);
  if (!byKey) {
    byKey = new Map();
    pages.set(window, byKey);
  }
  let page = byKey.get(key);
  if (!page) {
    page = { dead: new Set(), user: undefined, following: false, signingOut: false, reloading: false, refreshing: () => false };
    byKey.set(key, page);
  }
  return page;
}

type Outcome = "none" | "same" | "later" | "adopted" | "published" | "dropped";

/** Bring this origin's copy and the shared one in step: the newest wins. */
function reconcile(key: string, page: Page): Outcome {
  const jar = cookieJar();
  const signedOut = readSignedOut(jar, key);
  const isSignedOut = (copy: Copy) => signedOutCopy(copy, signedOut);

  const shared = readShared(jar, key);
  if (shared.state === "unreadable") return "none";
  let theirs = shared.state === "present" ? shared.copy : null;
  if (theirs && (isSignedOut(theirs) || page.dead.has(theirs.refreshToken))) theirs = null;

  const local = parseCopy(window.localStorage.getItem(key));

  if (local && isSignedOut(local)) {
    // Signed out on purpose somewhere after this copy was made.
    if (theirs) {
      window.localStorage.setItem(key, theirs.raw);
      return "adopted";
    }
    window.localStorage.removeItem(key);
    return "dropped";
  }
  if (!theirs) {
    if (!local) return "none";
    // No shared session is not evidence of a sign-out: share this one.
    writeCookieChunks(key, local.raw);
    return "published";
  }
  if (!local) {
    window.localStorage.setItem(key, theirs.raw);
    return "adopted";
  }
  if (local.raw === theirs.raw) return "same";
  if (theirs.expiresAt >= local.expiresAt) {
    // supabase-js reads its storage before and after a token request and throws
    // a valid refresh away when the copy changed in between. While one is in
    // flight, a newer copy of the same person waits for the next read; another
    // person is taken at once (the page reloads), so this page's refresh of the
    // previous person cannot replace that sign-in.
    if (page.refreshing() && theirs.userId !== null && theirs.userId === local.userId) return "later";
    window.localStorage.setItem(key, theirs.raw);
    return "adopted";
  }
  writeCookieChunks(key, local.raw);
  return "published";
}

/**
 * The same, in a page that is already running: when the person behind the
 * session changed (someone else signed in elsewhere, or signed out), a page
 * that was showing someone reloads, so nobody sees the previous person's
 * screen. A newer token for the same person changes nothing on screen.
 */
function reconcileInPage(key: string, page: Page): void {
  if (page.signingOut || page.reloading) return;
  try {
    const shown = page.user;
    const outcome = reconcile(key, page);
    if (outcome !== "adopted" && outcome !== "dropped") return;
    // undefined: the page has not been told who it shows yet; its own first read picks the session up.
    if (shown === undefined) return;
    const now = parseCopy(window.localStorage.getItem(key));
    const nowUser = now ? now.userId : null;
    if (outcome === "adopted" && (nowUser === null || nowUser === shown)) return;
    // A page on its sign-in screen (shown === null) reloads for a session that arrives, so it shows that person.
    if (outcome === "dropped" && shown === null) return;
    page.reloading = true;
    setTimeout(() => window.location.reload(), 0);
  } catch {
    // Never let session mirroring break the page.
  }
}

/**
 * Copy a session that arrived from another app into this origin's storage,
 * or share this origin's when it is the newer one. Must run before the
 * Supabase client reads its storage, so `createOsClient` calls it at module
 * scope.
 */
export function adoptSharedSession(projectRef: string): void {
  if (!sharingEnabled()) return;
  const key = storageKey(projectRef);
  try {
    reconcile(key, pageFor(key));
  } catch {
    // Storage blocked (private window, blocked cookies): fall back to a normal
    // per-app sign-in rather than breaking the page.
  }
}

type AuthEvents = {
  auth: {
    onAuthStateChange: (cb: (event: string, session: { user?: { id?: string } | null } | null) => void) => unknown;
  };
};

/** Keep the shared cookie in step with this app's session. */
export function publishSessionChanges(client: AuthEvents, projectRef: string): void {
  if (!sharingEnabled()) return;
  const key = storageKey(projectRef);
  try {
    client.auth.onAuthStateChange((event, session) => {
      try {
        const page = pageFor(key);
        if (event === "SIGNED_OUT") {
          page.user = null;
          // Only an explicit sign-out clears the shared session. With
          // followSharedSession installed it already has, inside
          // client.auth.signOut; any other SIGNED_OUT (a failed refresh,
          // another tab of this app) leaves the shared session alone.
          if (!page.following) clearCookieChunks(key);
          return;
        }
        if (session?.user?.id) page.user = session.user.id;
        else if (!session) page.user = null;
        publishLocal(key);
      } catch {
        // Never let session mirroring break authentication itself.
      }
    });
  } catch {
    // Never let session mirroring break authentication itself.
  }
}

/** Share this origin's session unless the shared one is newer. */
function publishLocal(key: string): void {
  const local = parseCopy(window.localStorage.getItem(key));
  if (!local) return;
  const jar = cookieJar();
  const signedOut = readSignedOut(jar, key);
  if (signedOutCopy(local, signedOut)) return;
  const shared = readShared(jar, key);
  if (shared.state === "present" && shared.copy.raw !== local.raw) {
    const theirs = shared.copy;
    const theirsSignedOut = signedOutCopy(theirs, signedOut);
    if (!theirsSignedOut && theirs.expiresAt > local.expiresAt) return;
  }
  writeCookieChunks(key, local.raw);
}

type StorageLike = {
  getItem: (key: string) => unknown;
  setItem: (key: string, value: string) => unknown;
  removeItem: (key: string) => unknown;
  isServer?: boolean;
};

const GUARDED = Symbol.for("autosolutions-os.sharedSession.guarded");

/**
 * Keep a running page on the newest session. Call it once, right after
 * creating the client and calling `publishSessionChanges`; `createOsClient`
 * does. It:
 *
 * - takes the newest session whenever the tab comes back into view or to
 *   focus, before supabase-js's own wake-up (which refreshes) reads it;
 * - takes it whenever supabase-js reads its session, which it does before
 *   every refresh, so a refresh never uses a token older than the shared one
 *   (while one is in flight, a newer copy of the same person waits for the
 *   next read, so supabase-js keeps that refresh);
 * - makes `client.auth.signOut()` (any scope but "others") the sign-out that
 *   clears the shared session everywhere.
 *
 * Every part is best effort: where a part cannot be installed, the others
 * still work, and nothing here can stop the client from signing in.
 */
export function followSharedSession(client: { auth: object }, projectRef: string): void {
  if (!sharingEnabled()) return;
  const key = storageKey(projectRef);
  try {
    const page = pageFor(key);
    if (page.following) return;
    page.following = true;
    const auth = client.auth as { storage?: StorageLike; signOut?: (...args: unknown[]) => unknown; refreshingDeferred?: unknown };
    // supabase-js holds a token request in flight in refreshingDeferred (internal, like storage).
    page.refreshing = () => auth.refreshingDeferred != null;
    guardReads(auth, key, page);
    signOutEverywhere(auth, key, page);
    const wake = () => {
      if (document.visibilityState === "hidden") return;
      reconcileInPage(key, page);
    };
    // On the document, so it runs before supabase-js's own listener on window.
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
  } catch {
    // Never let session mirroring break authentication itself.
  }
}

/** supabase-js reads its session through `auth.storage`; take the newest first. */
function guardReads(auth: { storage?: StorageLike }, key: string, page: Page): void {
  const inner = auth.storage;
  if (!inner || typeof inner.getItem !== "function" || typeof inner.setItem !== "function") return;
  if (typeof inner.removeItem !== "function" || (inner as Record<symbol, unknown>)[GUARDED]) return;
  const guarded: StorageLike = {
    getItem(name) {
      if (name === key) reconcileInPage(key, page);
      return inner.getItem(name);
    },
    setItem(name, value) {
      return inner.setItem(name, value);
    },
    removeItem(name) {
      if (name === key) rememberDead(key, page);
      return inner.removeItem(name);
    },
  };
  if (inner.isServer !== undefined) guarded.isServer = inner.isServer;
  Object.defineProperty(guarded, GUARDED, { value: true });
  auth.storage = guarded;
}

/** supabase-js removes a session it can no longer use: never take it back. */
function rememberDead(key: string, page: Page): void {
  try {
    const copy = parseCopy(window.localStorage.getItem(key));
    if (copy) page.dead.add(copy.refreshToken);
  } catch {
    // Nothing to remember.
  }
}

/**
 * An explicit sign-out signs out every app: clear the cookie and leave the note
 * first, and again once supabase-js has finished signing out.
 */
function signOutEverywhere(
  auth: { signOut?: (...args: unknown[]) => unknown },
  key: string,
  page: Page,
): void {
  const original = auth.signOut;
  if (typeof original !== "function") return;
  /**
   * Leave the note for the copies this origin and the shared cookie hold right
   * now (the latest expiry, and their sessions), then drop the shared copy.
   */
  const seal = (): void => {
    try {
      const local = parseCopy(window.localStorage.getItem(key));
      const shared = readShared(cookieJar(), key);
      const copies = [local, shared.state === "present" ? shared.copy : null].filter((c): c is Copy => c !== null);
      if (copies.length > 0) {
        writeSignedOut(
          key,
          Math.max(...copies.map((c) => c.expiresAt)),
          copies.flatMap((c) => (c.sessionId ? [c.sessionId] : [])),
        );
      }
      clearCookieChunks(key);
    } catch {
      // The sign-out itself still runs.
    }
  };
  auth.signOut = (...args: unknown[]) => {
    const scope = (args[0] as { scope?: unknown } | undefined)?.scope;
    if (scope !== "others") {
      page.signingOut = true;
      seal();
    }
    const done = () => {
      // When this origin's copy is due, supabase-js's signOut first waits for a
      // refresh already in flight, or refreshes itself, and that refresh saves
      // a rotated copy that expires after the note above. The note's session
      // ids keep that copy out of the cookie only when its access token names
      // its session, so seal again once the sign-out has finished: the note
      // then covers the copy by its expiry too, and the cookie ends empty.
      if (scope !== "others") seal();
      page.signingOut = false;
    };
    try {
      return Promise.resolve(original.apply(auth, args)).finally(done);
    } catch (error) {
      done();
      throw error;
    }
  };
}

/** The storage key, for server code that needs to find the cookie by name. */
export function sharedSessionCookieName(projectRef: string): string {
  return storageKey(projectRef);
}

/* ------------------------------------------------------------ app helpers */

/**
 * The Supabase project ref is the first label of `<ref>.supabase.co`; null
 * when the URL is not shaped like that, and sharing then stays off.
 */
export function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match ? (match[1] ?? null) : null;
  } catch {
    return null;
  }
}

/** The key supabase-js stores this project's session under. */
export function sharedSessionStorageKey(projectRef: string): string {
  return storageKey(projectRef);
}

/* ------------------------------------------------------------------ server */

/**
 * The server half: rebuild the session from an incoming request's Cookie
 * header, so a server-rendered page knows who the visitor is instead of
 * flashing a signed-out shell before the browser rehydrates. Returns the raw
 * Supabase session JSON, or null when the request carries no shared session
 * (or only one that an explicit sign-out has since ended).
 */
export function readSharedSessionCookie(cookieHeader: string | null | undefined, projectRef: string): string | null {
  if (!cookieHeader) return null;
  const jar = new Map<string, string>();
  for (const entry of cookieHeader.split(/;\s*/)) {
    const index = entry.indexOf("=");
    if (index > 0) jar.set(entry.slice(0, index).trim(), entry.slice(index + 1));
  }
  const key = storageKey(projectRef);
  const shared = readShared(jar, key);
  if (shared.state !== "present") return null;
  // The browser's rule: a copy at or before the note's watermark, or of a
  // session the note names, was ended by an explicit sign-out.
  if (signedOutCopy(shared.copy, readSignedOut(jar, key))) return null;
  return shared.copy.raw;
}

/** Just the access token from a shared-session cookie header. */
export function readSharedAccessToken(cookieHeader: string | null | undefined, projectRef: string): string | null {
  const raw = readSharedSessionCookie(cookieHeader, projectRef);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { access_token?: unknown } | null;
    return typeof parsed?.access_token === "string" ? parsed.access_token : null;
  } catch {
    return null;
  }
}
