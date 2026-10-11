import { test } from "node:test";
import assert from "node:assert/strict";
import { hashCode, randomSalt, checkLogin, signToken, verifyToken } from "../src/auth.js";

test("checkLogin accepts the right code (any case) and rejects wrong codes and unknown logins", async () => {
  const salt = randomSalt();
  const roster = { users: [{ login: "aruzhan.7a", name: "Aruzhan", role: "student", salt, hash: await hashCode("ab3cd9", salt) }] };
  assert.deepEqual(await checkLogin(roster, "Aruzhan.7A", "AB3CD9"), { login: "aruzhan.7a", name: "Aruzhan", role: "student" });
  assert.equal(await checkLogin(roster, "aruzhan.7a", "ab3cd8"), null);
  assert.equal(await checkLogin(roster, "nobody", "ab3cd9"), null);
});

test("session tokens verify, expire, and cannot be forged", async () => {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const tok = await signToken({ sub: "t", role: "teacher", exp }, "secret-1");
  assert.equal((await verifyToken(tok, "secret-1")).sub, "t");
  assert.equal(await verifyToken(tok, "secret-2"), null);
  const [, sig] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "t", role: "teacher", exp: exp + 9999 })).toString("base64url") + "." + sig;
  assert.equal(await verifyToken(forged, "secret-1"), null);
  assert.equal(await verifyToken(tok, "secret-1", (exp + 1) * 1000), null);
});
