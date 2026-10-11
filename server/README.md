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

## Voice

- **Asking by voice:** the student taps the microphone (after a one-time privacy notice), speaks for up to
  15 seconds and picks the language they are speaking. `/api/transcribe` sends the recording to OpenAI speech-to-text
  (`gpt-4o-mini-transcribe`) and returns only the text. The text appears in the message box so the student can fix
  it, and nothing is sent until they press Send. It then goes through the same `/api/ask` path as typed questions,
  so voice cannot skip the approved-materials search.
- **Listening to answers:** the 🔊 Listen button on AI answers uses OpenAI text-to-speech (`gpt-4o-mini-tts`), labelled
  "This voice is AI-generated". After the daily AI-voice limit or the monthly AI-voice cap ($3), or if the service fails,
  the device's free built-in voice is used, labelled "not AI".
- **If voice fails,** the microphone shows a message and typing keeps working. Set `VOICE_ENABLED = "false"` to turn
  voice off completely.
- **Recordings are never stored or logged.** Each recording is held in memory for one request and then discarded.
  The transcript goes back only to the student's browser. OpenAI's API data policy applies to what is sent to OpenAI
  (no training on API data by default; possible retention of up to 30 days for abuse monitoring). Check this against
  your school's rules.
- **Voice limits** (`wrangler.toml`): 15 seconds and 600 KB per recording, 8 voice questions and 3 AI-voice answers per
  student per day, 600 characters per spoken answer, $3 a month for the AI voice. All of it also counts toward the
  overall monthly budget.
- **Testing:** the teacher's **Run voice self-test** speaks 6 questions with the AI voice (an in-book and an off-topic
  one in English, Russian and Kazakh), transcribes them and runs them through the tutor. It reports transcription
  accuracy and whether each answer was given or declined correctly. The test voice is synthetic, so also try real
  student recordings.

Nothing about the conversation is stored. The server keeps only counters: questions per student per day,
spending per month and failed sign-ins.

## Files

| Path | What it is |
|---|---|
| `materials/` | The approved documents, and `approved.json`, which lists the ones the AI may use |
| `src/chunks.json` | The approved documents split into cited excerpts (generated) |
| `src/index.js` | Routes: `/api/health`, `/api/login`, `/api/ask`, `/api/transcribe`, `/api/tts`, `/api/admin/usage`, `/api/admin/selftest`, `/api/admin/voice-selftest` |
| `src/rag.js` | Search, prompt and answer checks |
| `src/auth.js` | Code hashing and session tokens |
| `src/ledger.js` | Durable Object with the counters (SQLite) |
| `src/selftest.js` | Questions used by the teacher's "Run AI self-test" button |
| `src/voice.js` | Voice costs, transcription hints and the voice self-test questions |
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
