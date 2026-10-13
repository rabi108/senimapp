// Manages student and teacher logins.
//   npm run roster -- add <login> "<Name>" [teacher]   add a person (a code is generated)
//   npm run roster -- reset <login>                     give someone a new code
//   npm run roster -- setcode <login> <code>            set a chosen code (use --students for every student)
//   npm run roster -- remove <login>
//   npm run roster -- list                              show logins and codes (for printing cards)
//   npm run roster -- --upload                          send the hashed list to Cloudflare (ROSTER_JSON secret)
// Plain codes stay in roster.local.json on your computer (git-ignored). Only salted hashes are uploaded.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { hashCode, randomSalt, PBKDF2_ITERATIONS } from "../src/auth.js";

const FILE = new URL("../roster.local.json", import.meta.url);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join("");

const people = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
const save = () => writeFileSync(FILE, JSON.stringify(people, null, 2) + "\n", { mode: 0o600 });
const [cmd, login, name, role] = process.argv.slice(2);

if (cmd === "add") {
  if (!login || !name) throw new Error('Usage: npm run roster -- add <login> "<Name>" [teacher]');
  const l = login.toLowerCase();
  if (people.some((p) => p.login === l)) throw new Error(`${l} already exists`);
  people.push({ login: l, name, role: role === "teacher" ? "teacher" : "student", code: newCode() });
  save(); console.log(`Added ${l}. Run "npm run roster -- list" to see the code, then upload.`);
} else if (cmd === "reset") {
  const p = people.find((x) => x.login === String(login).toLowerCase());
  if (!p) throw new Error("No such login");
  p.code = newCode(); save(); console.log(`New code for ${p.login} saved. Upload to apply it.`);
} else if (cmd === "setcode") {
  const code = name;
  if (!login || !code || code.length < 4) throw new Error("Usage: npm run roster -- setcode <login|--students> <code of 4+ characters>");
  const who = login === "--students" ? people.filter((p) => p.role === "student") : people.filter((p) => p.login === login.toLowerCase());
  if (!who.length) throw new Error("No such login");
  for (const p of who) p.code = code;
  save(); console.log(`Code set for ${who.map((p) => p.login).join(", ")}. Upload to apply it.`);
} else if (cmd === "remove") {
  const i = people.findIndex((x) => x.login === String(login).toLowerCase());
  if (i < 0) throw new Error("No such login");
  people.splice(i, 1); save(); console.log("Removed. Upload to apply it.");
} else if (cmd === "list") {
  for (const p of people) console.log(`${p.login.padEnd(20)} ${p.code}   ${p.role.padEnd(8)} ${p.name}`);
} else if (cmd === "--upload") {
  const users = [];
  for (const p of people) {
    const salt = randomSalt();
    users.push({ login: p.login, name: p.name, role: p.role, salt, iter: PBKDF2_ITERATIONS, hash: await hashCode(p.code, salt) });
  }
  const r = spawnSync("npx", ["wrangler", "secret", "put", "ROSTER_JSON"], { input: JSON.stringify({ version: 1, users }), stdio: ["pipe", "inherit", "inherit"] });
  process.exit(r.status ?? 1);
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 9).join("\n"));
}
