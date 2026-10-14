// @vitest-environment node
/**
 * The shared session in this app (sharedSession.ts, autosolutions-os 0.2.6's
 * copy). The package runs the full suite; this checks the copy behaves the
 * same here, and that this app's client module wires all three calls.
 *
 * Set the two paths below for the app (PORT.md lists them). Label Maker runs
 * it with bun: change "vitest" to "bun:test" in the import.
 *
 * No network: global fetch throws, and every session here is far from expiry,
 * so supabase-js never tries to refresh.
 */
import { afterEach, describe, expect, test } from "vitest";

import { adoptSharedSession, followSharedSession, publishSessionChanges, readSharedSessionCookie } from "./sharedSession";

/** The module that creates this app's Supabase client and runs the three calls. */
const CLIENT_MODULE = "./supabaseClient";

const REF = "allzlfxbemhhhihdpxfv";
const KEY = `sb-${REF}-auth-token`;
const HOST = "design-studio.autosolutions.app";
const LATER = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

/* A browser just big enough: one cookie jar for every *.autosolutions.app origin. */
class Jar {
  cookies = new Map<string, string>();
  set(header: string): void {
    const [pair = ""] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) return;
    const name = pair.slice(0, eq).trim();
    if (/max-age=0(;|$)/i.test(header.replace(/\s/g, ""))) this.cookies.delete(name);
    else this.cookies.set(name, pair.slice(eq + 1));
  }
  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function page(jar: Jar) {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, String(value)),
    removeItem: (key: string) => void values.delete(key),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
  };
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const doc = new EventTarget() as EventTarget & Record<string, unknown>;
  Object.defineProperty(doc, "cookie", { get: () => jar.header(), set: (value: string) => jar.set(value) });
  Object.defineProperty(doc, "visibilityState", { get: () => "visible" });
  const reloads: number[] = [];
  win.location = { hostname: HOST, host: HOST, origin: `https://${HOST}`, href: `https://${HOST}/`, reload: () => reloads.push(1) };
  win.localStorage = storage;
  win.document = doc;
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.document = doc;
  g.localStorage = storage;
  return { storage, win, reloads };
}

function session(user: string, refreshToken: string, expiresAt: number) {
  return { access_token: `a-${refreshToken}`, token_type: "bearer", expires_in: 3600, expires_at: expiresAt, refresh_token: refreshToken, user: { id: user, email: `${user}@example.com` } };
}

/** An access token shaped like Supabase's: a JWT whose payload carries the session's id. */
function token(sessionId: string): string {
  const payload = btoa(JSON.stringify({ session_id: sessionId })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
}

const putShared = (jar: Jar, value: unknown) => jar.set(`${KEY}.0=${encodeURIComponent(JSON.stringify(value))}; Domain=.autosolutions.app; Path=/`);
const shared = (jar: Jar) => {
  const raw = jar.cookies.get(`${KEY}.0`);
  return raw ? (JSON.parse(decodeURIComponent(raw)) as { refresh_token: string }) : null;
};
const local = (storage: { getItem: (k: string) => string | null }) =>
  (JSON.parse(storage.getItem(KEY) ?? "null") as { refresh_token?: string } | null)?.refresh_token ?? null;

type SessionLike = { user?: { id?: string } | null } | null;

function fakeClient(refreshInSignOut?: ReturnType<typeof session>) {
  const listeners: ((event: string, value: SessionLike) => void)[] = [];
  const auth = {
    storage: (globalThis as unknown as { localStorage: { getItem: (k: string) => unknown; setItem: (k: string, v: string) => unknown; removeItem: (k: string) => unknown } }).localStorage,
    onAuthStateChange(cb: (event: string, value: SessionLike) => void) {
      listeners.push(cb);
    },
    async signOut() {
      if (refreshInSignOut) {
        // supabase-js refreshes an expired copy inside signOut, before the server logout.
        auth.storage.setItem(KEY, JSON.stringify(refreshInSignOut));
        for (const cb of listeners) cb("TOKEN_REFRESHED", refreshInSignOut);
      }
      auth.storage.removeItem(KEY);
      for (const cb of listeners) cb("SIGNED_OUT", null);
      return { error: null };
    },
    emit(event: string, value: SessionLike) {
      for (const cb of listeners) cb(event, value);
    },
  };
  return { auth };
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.document;
  delete g.localStorage;
});

describe("the shared session copy", () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  test("on load the newest copy wins: an older local copy never overwrites a newer shared one", () => {
    const jar = new Jar();
    const { storage } = page(jar);
    storage.setItem(KEY, JSON.stringify(session("u1", "older", LATER - 100)));
    putShared(jar, session("u1", "newer", LATER));
    adoptSharedSession(REF);
    expect(local(storage)).toBe("newer");
    expect(shared(jar)?.refresh_token).toBe("newer");
  });

  test("a copy older than an explicit sign-out elsewhere is dropped, not shared again", () => {
    const jar = new Jar();
    const { storage } = page(jar);
    storage.setItem(KEY, JSON.stringify(session("u1", "mine", LATER)));
    jar.set(`${KEY}-signed-out=${LATER}; Domain=.autosolutions.app; Path=/`);
    adoptSharedSession(REF);
    expect(storage.getItem(KEY)).toBeNull();
    expect(shared(jar)).toBeNull();
  });

  test("an open page takes the newest session when it gets focus, and an explicit sign-out clears it everywhere", async () => {
    const jar = new Jar();
    const { storage, win } = page(jar);
    const client = fakeClient();
    storage.setItem(KEY, JSON.stringify(session("u1", "older", LATER - 100)));
    publishSessionChanges(client, REF);
    followSharedSession(client, REF);
    client.auth.emit("SIGNED_IN", session("u1", "older", LATER - 100));
    putShared(jar, session("u1", "newer", LATER));
    win.dispatchEvent(new Event("focus"));
    expect(local(storage)).toBe("newer");
    await client.auth.signOut();
    expect(shared(jar)).toBeNull();
    expect(jar.cookies.get(`${KEY}-signed-out`)).toBe(String(LATER));
  });

  test("a sign-out whose own refresh renews the session (an app left idle) still ends it everywhere, the server half included", async () => {
    // The refreshed copy expires later than the note, but keeps the session's id.
    const jar = new Jar();
    const { storage } = page(jar);
    const signedIn = { ...session("u1", "r1", LATER - 100), access_token: token("s1") };
    const refreshed = { ...session("u1", "r2", LATER), access_token: token("s1") };
    const client = fakeClient(refreshed);
    storage.setItem(KEY, JSON.stringify(signedIn));
    publishSessionChanges(client, REF);
    followSharedSession(client, REF);
    client.auth.emit("SIGNED_IN", signedIn);
    expect(shared(jar)?.refresh_token).toBe("r1");
    await client.auth.signOut();
    expect(shared(jar)).toBeNull();
    expect(jar.cookies.get(`${KEY}-signed-out`)).toBe(`${LATER - 100}|s1`);

    // Another app still holding the refreshed copy drops it instead of sharing it.
    const other = page(jar);
    other.storage.setItem(KEY, JSON.stringify(refreshed));
    adoptSharedSession(REF);
    expect(other.storage.getItem(KEY)).toBeNull();
    expect(shared(jar)).toBeNull();

    // The server half ignores it too, even when an app without the change puts it back,
    // and a later sign-in (a new session) is not affected.
    putShared(jar, refreshed);
    expect(readSharedSessionCookie(jar.header(), REF)).toBeNull();
    const signedInAgain = { ...session("u1", "r3", LATER + 100), access_token: token("s2") };
    putShared(jar, signedInAgain);
    expect(readSharedSessionCookie(jar.header(), REF)).toBe(JSON.stringify(signedInAgain));
  });

  test("a SIGNED_OUT that is not a sign-out (a failed refresh) leaves the shared session alone", () => {
    const jar = new Jar();
    const { storage } = page(jar);
    const client = fakeClient();
    putShared(jar, session("u1", "r1", LATER));
    storage.setItem(KEY, JSON.stringify(session("u1", "r1", LATER)));
    publishSessionChanges(client, REF);
    followSharedSession(client, REF);
    storage.removeItem(KEY);
    client.auth.emit("SIGNED_OUT", null);
    expect(shared(jar)?.refresh_token).toBe("r1");
  });

  test("reloads when a session arrives on focus, so it shows that person", async () => {
    const jar = new Jar();
    const { storage, win, reloads } = page(jar);
    const client = fakeClient();
    publishSessionChanges(client, REF);
    followSharedSession(client, REF);
    client.auth.emit("INITIAL_SESSION", null);
    putShared(jar, session("u1", "arrived", LATER));
    win.dispatchEvent(new Event("focus"));
    await tick();
    expect(local(storage)).toBe("arrived");
    expect(reloads.length).toBe(1);
  });

  test("a page on its sign-in screen does not reload when nothing arrived", async () => {
    const jar = new Jar();
    const { win, reloads } = page(jar);
    const client = fakeClient();
    publishSessionChanges(client, REF);
    followSharedSession(client, REF);
    client.auth.emit("INITIAL_SESSION", null);
    win.dispatchEvent(new Event("focus"));
    await tick();
    expect(reloads.length).toBe(0);
  });
});

describe("this app's client module", () => {
  test("adopts the newer shared session before the client reads it, and follows it", async () => {
    const g = globalThis as Record<string, unknown>;
    const realFetch = g.fetch;
    const realBroadcast = g.BroadcastChannel;
    g.fetch = () => Promise.reject(new Error("no network in this test"));
    delete g.BroadcastChannel;
    try {
      const jar = new Jar();
      const { storage } = page(jar);
      storage.setItem(KEY, JSON.stringify(session("u1", "older", LATER - 100)));
      putShared(jar, session("u1", "newer", LATER));
      type Auth = { initialize: () => Promise<unknown>; stopAutoRefresh: () => Promise<void>; storage: Record<symbol, unknown> };
      const mod = (await import(/* @vite-ignore */ CLIENT_MODULE)) as unknown as { supabase: { auth: Auth } };
      const auth = mod.supabase.auth;
      await auth.initialize();
      expect(local(storage)).toBe("newer");
      expect(auth.storage[Symbol.for("autosolutions-os.sharedSession.guarded")]).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(auth, "signOut")).toBe(true);
      await auth.stopAutoRefresh();
    } finally {
      g.fetch = realFetch;
      g.BroadcastChannel = realBroadcast;
    }
  });
});

describe("a sign-out that races this app's own refresh", () => {
  test("a refresh that shares its rotated copy while the sign-out waits for it cannot bring the session back", async () => {
    // Tokens that name no session: the sign-out's second seal is what keeps the rotated copy out.
    const jar = new Jar();
    const { storage } = page(jar);
    storage.setItem(KEY, JSON.stringify(session("u1", "r1", LATER - 100)));
    putShared(jar, session("u1", "r1", LATER - 100));
    // the refresh that was already in flight finishes first and shares its rotated copy
    const client = fakeClient(session("u1", "r2", LATER));
    publishSessionChanges(client, REF);
    followSharedSession(client, REF);
    // the scope this app signs out with (hardSignOut); the fake signOut itself takes no options
    await (client.auth.signOut as (options: { scope: string }) => Promise<unknown>)({ scope: "local" });
    expect(storage.getItem(KEY)).toBeNull();
    expect(shared(jar)).toBeNull();
    // a page loading later must not adopt the copy the sign-out just ended
    adoptSharedSession(REF);
    expect(storage.getItem(KEY)).toBeNull();
  });
});
