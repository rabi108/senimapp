# Senim Space Terms: a demo tutoring app for terminology

A small tutor that helps Grade 7 students learn science terms **before** class, with a Kazakh or Russian glossary.
It is one file, `index.html`. Open it in any browser; it needs no server, no build step and no API key.

## Student flow

1. **App icon**: tap it to open the app.
2. **Sign in** with a login and a sign-in code. Demo accounts:

   | Login | Code | Notes |
   |---|---|---|
   | `aruzhan.7a` | `4821` | student, lessons unlock in order |
   | `daniyar.7b` | `1937` | student |
   | `teacher` | `0000` | every lesson unlocked, for previewing |

3. **Setup quiz**: the student picks a glossary language (Қазақша / Русский) and rates their English. Two short reading
   checks then place them at a level: Starter, Middle or Advanced.
4. **Tutor chat** with a course map, the lessons, games, the glossary, XP and badges.

## Course (only from the attached CKLA materials)

| Lesson | Key terms | Source | Game |
|---|---|---|---|
| 1. Orbit & Axis | **orbit**, **axis** (plus rotate, tilted, solar system) | Reader Ch. 1, pp. 6–15 | *Orbit or Axis?*: sort the clues |
| 2. Eclipse | **eclipse** (plus solar/lunar eclipse, reflect) | Reader Ch. 2, pp. 16–23 | *Eclipse Builder*: line up Sun, Moon and Earth |
| 3. Naked Eye & Probe | **naked eye**, **probe** (plus telescope) | Reader Ch. 3, pp. 24–31 | *Mission Control*: pick naked eye, telescope or probe |
| Final | all 6 terms | glossary | *Term Match*: memory game, English ↔ translation |

Definitions come from the Unit 7 Teacher Guide vocabulary lists and the Read-Aloud Anthology glossary. Example
sentences are quoted from the Reader, with page numbers.

Each lesson runs in this order: a short hook → term card (definition, book quote, translation, "Hear it" button) →
guided questions → the game → free questions → a 3-question check (stars) → a badge.

## How the tutoring works

- **About half the turns are Socratic.** Lesson scripts alternate *Think it through* turns (the tutor asks, gives
  hints step by step, and explains only when the student is stuck) with *Explanation* turns. Free questions keep the
  balance: when guided turns fall below 50%, the tutor answers a question with a guiding question first. The student
  can always say "hint" or "just tell me". The sidebar meter *How I teach you* shows the current split.
- **Knowledge base limited to the book.** Free questions are matched against a curated set of facts from Reader
  Chapters 1–3 (in `KB` inside `index.html`), and every answer cites its page. Anything outside the book gets "I can't
  find that in our book, please bring it to class" instead of a guess. Students can ask in English, and some Russian
  and Kazakh keywords also work (e.g. "затмение", "тұтылу"). "What is axis in Russian?" returns the translation.
- **Translation on request.** Every tutor message has a translate button (Аудару / Перевести). Students can also type
  "translate", "аудар", "переведи", "I don't understand", "түсінбедім" or "не понимаю" to get the last message in
  their language, or in Kazakh or Russian if they name it. All lesson text, hints, feedback and book answers are written
  in English, Kazakh and Russian (`t(english, kazakh, russian)` in the code). Game clues and quick-check questions stay
  in English on purpose, because they are English practice.
- **Wrong answers.** When an answer is wrong, the tutor says it is not correct and that the book says something
  different. Then it explains the term again and repeats the question. Further wrong answers get hints, and finally the
  answer. If a student types a statement instead of a question (e.g. "the moon makes its own light"), the tutor checks
  it against the book.
- **Level adaptation.** Starter: simpler definitions, translations next to every term, up to 3 hints, answer choices
  every time. Middle: translations on tap, 2 hints, some typed answers. Advanced: book definitions, 1 hint, typed
  answers. Students can change the language and level in the menu.
- **Gamification.** XP for correct answers (more on the first try), a combo bonus for 3 correct in a row, ranks
  (Space Cadet → Mission Commander), stars per lesson, 4 badges, and lessons that unlock in order.

Progress is saved in the browser's `localStorage`, separately for each login.

## Editing content

All content is near the top of the `<script>` in `index.html`:
- `TERMS`: glossary entries (English definition per level, word family, book quote, Kazakh and Russian).
- `LESSONS`: the step-by-step lesson scripts (`soc` = guided question with hints, `dir` = explanation, `term`,
  `game`, `explore`, `exit`).
- `KB`: facts the free-question tutor may use, each with an optional Socratic version.
- `ROSTER`: logins and sign-in codes. This is a demo only: the codes sit in the page, so this is not real security.
