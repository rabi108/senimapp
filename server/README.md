# Senim tutor server (Cloudflare Worker)

Serves the tutor page and the AI tutor API from one address:
https://senim-tutor-server.senim-tutor-server.workers.dev/

## How a free question is answered

1. The student signs in with a login and code from the teacher. The server checks the code against salted
   hashes and gives the browser an 8-hour session token.
2. If the question matches a guided question in the offline tutor and the tutor needs more guided turns, the page
   answers it offline, for free, which keeps the 50% guided / 50% explained balance. All other questions go to `/api/ask`.
3. The server checks the student's daily limit and the monthly budget. It then embeds the question and finds the
   closest excerpts from the **approved materials only** (`materials/approved.json`).
4. If no excerpt is close enough, the question is declined without calling the model.
5. Otherwise the model gets only those excerpts. It must answer from them, in simple English plus a
   Kazakh or Russian translation, and cite the excerpt ids. The server rejects any answer that is not
   marked as supported or does not cite an excerpt it was given.
6. If the AI is unavailable, over the daily limit or over the budget, the page answers from the offline lesson notes.

Nothing about the conversation is stored. The server keeps only counters: questions per student per day,
spending per month and failed sign-ins.

## Files

| Path | What it is |
|---|---|
| `materials/` | The approved documents, and `approved.json`, which lists the ones the AI may use |
| `src/chunks.json` | The approved documents split into cited excerpts (generated) |
| `src/index.js` | Routes: `/api/health`, `/api/login`, `/api/ask`, `/api/admin/usage`, `/api/admin/selftest` |
| `src/rag.js` | Search, prompt and answer checks |
| `src/auth.js` | Code hashing and session tokens |
| `src/ledger.js` | Durable Object with the counters (SQLite) |
| `src/selftest.js` | Questions used by the teacher's "Run AI self-test" button |
| `scripts/roster.mjs` | Add, reset and remove logins, and upload them |
| `wrangler.toml` | Settings and limits (see `[vars]`) |

## Common tasks (run in `server/`)

```
npm install                                   # once
npm test                                      # unit tests
npm run roster -- add <login> "<Name>"        # add a student (add "teacher" at the end for a teacher)
npm run roster -- list                        # see codes to print login cards
npm run roster -- --upload                    # apply login changes on the server
npm run build-materials                       # after changing materials/ or approved.json
npm run deploy                                # publish changes
```

`roster.local.json` holds the plain codes. It is git-ignored, so keep a safe copy.

Limits live in `wrangler.toml` under `[vars]`: AI questions per student per day, answer length, question
length, monthly budget (hard stop), model and prices. Change a value, then run `npm run deploy`.

## Secrets (never in the repo)

Set with `npx wrangler secret put NAME`: `OPENAI_API_KEY`, `SESSION_SECRET` (any long random string) and
`ROSTER_JSON` (set by `npm run roster -- --upload`).

## Testing without spending money

Copy `.dev.vars.example` to `.dev.vars`, set `MOCK_OPENAI=1` and `MIN_SIMILARITY=0.1`, create a test roster,
then run `npm run dev`. The mock answers from the top excerpt and never calls OpenAI.
On the live site, the teacher's **Run AI self-test** button checks 7 questions the book answers and 5 it doesn't,
for about one cent.

Materials: Core Knowledge Language Arts (CKLA) Grade 3 Unit 7, © Core Knowledge Foundation, CC BY-NC-SA 3.0.
