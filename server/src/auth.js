// Login codes and session tokens. Uses only Web Crypto, so it runs in the Worker and in Node scripts.

const enc = new TextEncoder();
export const PBKDF2_ITERATIONS = 100000; // the Workers runtime allows at most 100,000

function b64(bytes) { let s = ""; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s); }
function unb64(str) { const s = atob(str); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

export function randomSalt() { return b64(crypto.getRandomValues(new Uint8Array(16))); }

/** PBKDF2-SHA256 hash of a login code, returned as base64. */
export async function hashCode(code, saltB64, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(code).trim().toLowerCase()), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations }, key, 256);
  return b64(bits);
}

/** Compares two strings in time that does not depend on where they differ. */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a login + code against the roster. Returns the user (without secrets) or null. */
export async function checkLogin(roster, login, code) {
  const user = (roster.users || []).find((u) => u.login === String(login || "").trim().toLowerCase());
  // Hash even for an unknown login, so response time does not reveal which logins exist.
  const salt = user ? user.salt : "AAAAAAAAAAAAAAAAAAAAAA==";
  const hash = await hashCode(code || "", salt, user ? user.iter || PBKDF2_ITERATIONS : PBKDF2_ITERATIONS);
  if (!user || user.active === false || !safeEqual(hash, user.hash)) return null;
  return { login: user.login, name: user.name, role: user.role === "teacher" ? "teacher" : "student" };
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Signed session token: base64url(JSON payload) + "." + base64url(HMAC-SHA256). */
export async function signToken(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return body + "." + b64url(sig);
}

/** Returns the payload of a valid, unexpired token, or null. */
export async function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64url(sig), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    return payload.exp && payload.exp * 1000 > now ? payload : null;
  } catch { return null; }
}
