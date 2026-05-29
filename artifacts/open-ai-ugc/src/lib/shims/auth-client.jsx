import { useEffect, useState } from "react";

/**
 * Minimal replacement for next-auth/react backed by the Express JWT-cookie API
 * (/api/auth/*). Exposes a tiny pub/sub store so signIn/signOut update every
 * mounted useSession()/SessionProvider instantly.
 */

const listeners = new Set();
let cache = { data: null, status: "loading" };
let fetching = null;

async function fetchSession() {
  if (fetching) return fetching;
  fetching = (async () => {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      const data = json && json.user ? json : null;
      cache = { data, status: data ? "authenticated" : "unauthenticated" };
    } catch {
      cache = { data: null, status: "unauthenticated" };
    }
    listeners.forEach((l) => l(cache));
    fetching = null;
    return cache;
  })();
  return fetching;
}

function useStore() {
  const [state, setState] = useState(cache);
  useEffect(() => {
    const l = (s) => setState({ ...s });
    listeners.add(l);
    if (cache.status === "loading") fetchSession();
    else setState(cache);
    return () => listeners.delete(l);
  }, []);
  return state;
}

export function SessionProvider({ children }) {
  useStore();
  return children;
}

export function useSession() {
  return useStore();
}

export async function getSession() {
  const s = await fetchSession();
  return s.data;
}

export async function signIn(provider, opts = {}) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: opts.email, password: opts.password }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    return { ok: false, error: data.error || "CredentialsSignin", status: res.status, url: null };
  }
  await fetchSession();
  return { ok: true, error: null, status: 200, url: opts.callbackUrl || null };
}

export async function signOut(opts = {}) {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  await fetchSession();
  if (opts.callbackUrl) window.location.href = opts.callbackUrl;
  return { url: opts.callbackUrl || null };
}
