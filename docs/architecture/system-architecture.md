# System architecture of the Senim tutor, based on Berengueres (2025)

This design starts from the lesson plan-driven chatbot OS315 described in

> Berengueres, J. (2025). Comparing lesson plan-driven and ask-me-anything chatbots: teaching a UNIX Shell course.
> *Discover Education*, 4, 93. https://doi.org/10.1007/s44217-025-00492-9

Section numbers in brackets, such as [§2.3], refer to that paper. Senim keeps the OS315 architecture (Fig. 1 in the
paper) and changes the parts where the paper reports a problem or a limit.

![Fig. 1](architecture.png)

**Fig. 1** The system architecture of the Senim tutor. Solid lines are API calls and dashed lines are configuration.
As in OS315, the AI is kept apart from the student chat interface, so the chat can only be used for its intended
purpose. Numbers match the steps below.

## 1. Design goals taken from the study

| Finding in the study | What it means for Senim |
|---|---|
| Students preferred the lesson plan-driven chatbot to the ask-me-anything one (Wilcoxon p = 2e−05) [§4.2.3]. They liked that "it asks me questions on its own" [§4.2.1]. | The tutor leads. Each lesson follows a fixed plan of key terms and Socratic questions. |
| More than half of the students wanted a mix of human and chatbot teaching [§4.1.3]. Some wanted to stop the bot and ask their own question but did not know whether they could [§5.1]. | Free questions are always allowed, and the tutor says so. Guided steps take about half of the conversation and free answers the other half. The teacher still teaches the lesson first. |
| The same architecture failed for a Data Visualization course (NPS +9). Answers there were "unrelated to the book's content" [§5.4]. Few-shot prompting did not fix this. | The model is not trusted to stay on the book by itself. It sees only retrieved excerpts from the approved materials and must cite them, and the server checks the citations (RAG). |
| Small prompt changes had unpredictable effects, such as an emoji sentence cutting verbosity by about 30% [§5.3]. | Lessons, questions, hints and the glossary are written in the page, not generated. The model is used only for free questions, through a strict answer schema. |
| Speed was the top complaint, with delays of 2–8 s against the 400 ms Doherty threshold [§5.1]. | Guided steps, games and the glossary run in the browser with no wait. A small model (`gpt-5.4-nano`, reasoning off) answers only the free questions. |
| Cost was about 2.5 cents per request, and $1.12 per student for three hours, plus $40 a month fixed [§4.1.1, §5.5]. The chatbots were later taken offline to save hosting costs [§3]. | Hosting is a serverless Worker with no monthly fee. Limits per student per day and a hard $18 monthly stop keep the bill inside a $20 budget. The tutor keeps working offline when the budget runs out. |
| The modular design gave privacy and freedom to change AI provider [§6]. | The key stays on the server. The page never talks to OpenAI directly. Only counters and a progress summary are stored, never conversations or recordings. |
| Students in OS315 were adults (20–24) in English [§3.3]. | Senim is for 7th graders learning English, so it uses simple English, a Kazakh/Russian glossary, translation on request, voice, and gamification. |
| Only preferences were measured, not learning [§6.1]. Novelty effects were not controlled [§5.6]. | The teacher view records lessons finished, stars and words learned for each student, which can later be compared with test results. |

## 2. Architecture, step by step

The steps follow the structure of [§2.3].

1. **Instructor.** The teacher prepares the *lesson plan* and the *approved materials*. This is the same as step (1)
   in OS315, which uses a prompt and a lesson plan.
   - Lesson plan: three short lessons, each with one or two key terms (orbit, axis; eclipse; naked eye, probe), plus a
     final term match. Each lesson has Socratic questions, a hint ladder and accepted answers. The plan is written into
     the page (`space-terms/index.html`).
   - Approved materials: Reader *What's in Our Universe?* Ch. 1–3, Teacher Guide vocabulary and Anthology glossary,
     listed in `server/materials/approved.json`.
   - Logins and limits: `npm run roster` and `server/wrangler.toml [vars]`.
2. **Repository and build.** In OS315 the prompt is pasted into an OpenAI "Assistant" (step 2). In Senim the
   prompt, the answer schema and the materials split into cited excerpts (`server/src/chunks.json`) are kept in the
   GitHub repository. Every change can be reviewed there, and `npm run deploy` publishes it.
3. **Secret key.** In OS315 the key is held by Flowise (step 3). In Senim, `OPENAI_API_KEY`, `SESSION_SECRET` and
   `ROSTER_JSON` (hashed sign-in codes) are secrets of the Cloudflare Worker. They never reach the repository or the
   browser.
4. **Middleware: Cloudflare Worker.** This replaces Flowise on HuggingFace/Render. It connects the AI to the student
   interface and does five jobs:
   - sign-in with a login and code, 8-hour sessions, and student/teacher roles;
   - answering free questions (RAG): a Kazakh/Russian question is translated to English, embedded, and matched
     against the top 4 excerpts. The model answers only from those excerpts, and the server checks the citations;
   - voice: speech-to-text for questions (the student edits the text before sending) and AI voice for answers,
     labelled as AI;
   - limits and spending for each student, each day and each month;
   - teacher endpoints for progress, spending and the self-tests.
5. **AI provider: OpenAI API.** This is the paper's "Assistant". Senim uses `text-embedding-3-small` for search,
   `gpt-5.4-nano` for answers and translation, `gpt-4o-mini-transcribe` for voice questions and `gpt-4o-mini-tts` for
   spoken answers. Answer requests use `store: false`. Because the Worker sits in between, the provider can be changed
   without changing the page [§6].
6. **State: Ledger.** A Durable Object with SQLite storage keeps the questions per student per day, the spending per
   month, failed sign-ins, the progress summary and the cached search index. OS315 has no matching part, because the
   Assistant keeps the conversation.
7. **"Stay on topic" policy.** In OS315 this is step (4), a policy set on the Flowise widget. Senim enforces it in code
   instead of a prompt:
   - questions with no excerpt above the similarity threshold (0.25) are declined without calling the model;
   - answers must be marked as supported and cite only the excerpts they were given;
   - questions are limited to 400 characters and 20 a day for each student, with 8 voice questions a day;
   - the AI voice has a $3 monthly cap, and all AI stops at $18 a month.
8. **Student interface and feedback.** In OS315 the chat widget is hosted on GitHub Pages (step 5) and students give
   feedback by survey (step 6). Senim's page is served by the same Worker and also works offline. Students open it
   from the app icon on the start screen, sign in, take the language and level quiz, and then chat. The teacher view shows each
   student's progress bar, stars, XP and words learned, the AI spending, and the AI and voice self-tests.

## 3. Request flow for one free question

```
Student types or says a question
  → Page: is it a guided step the offline tutor can answer? → yes: answer in the browser (free, instant)
  → no: POST /api/ask with the session token
      → Worker: check the token, then the daily limit and the monthly budget (Ledger)
      → Kazakh/Russian? translate to English (gpt-5.4-nano)
      → embed (text-embedding-3-small) → top 4 excerpts from the approved materials
      → best score below 0.25? → decline politely, give the question back, no model call
      → gpt-5.4-nano with only those excerpts, strict JSON {supported, answer, translation, sources}
      → server checks that sources ⊂ retrieved excerpts → else decline
      → add the cost to the Ledger → reply with the answer, the translation and the cited pages
  → Page: show the answer, 🔊 Listen (AI voice, labelled), and come back to the lesson plan
```

## 4. Differences from OS315

| | OS315 [§2.3] | Senim |
|---|---|---|
| Teaching style | Lesson plan-driven | Lesson plan-driven, plus free questions answered from the book (the mix students asked for) |
| Base model | GPT-3.5-turbo-1106 through Assistants | gpt-5.4-nano through the Responses API, with retrieval |
| Grounding | Lesson plan in the prompt | Retrieved, cited excerpts that the server checks |
| Middleware | Flowise (hosted, $20/month) | Cloudflare Worker (serverless) and a Durable Object |
| Key storage | Flowise | Worker secrets |
| Topic policy | Policy on the Flowise widget | Similarity threshold, citation check, limits and budget |
| Front end | Widget on GitHub Pages | Page served by the same Worker, with an offline tutor |
| Input and output | Text | Text and voice, in English, with Kazakh/Russian help |
| Feedback | Surveys (NPS) | Teacher view with progress, spending and self-tests |
| Cost control | None reported (bill of $88 a month) | Daily limits and an $18 monthly stop |

## 5. Evaluation plan, following the study

To compare Senim with the study, use its measures [§3.4, §4]:

- **NPS:** after each lesson, ask "Would you recommend the tutor to a friend to learn English?" on a 1–5 scale, and
  count 5 as a promoter, 4 as passive and 1–3 as a detractor.
- **Preference:** "Human teacher or tutor?" on a 5-point scale, as in Fig. 5 of the paper.
- **Engagement:** the length of each conversation. The paper reports a median of about 3.9k characters [§4.2.2].
- **Grounding:** the teacher's AI self-test (7 questions the book answers and 5 it does not) and the voice self-test.
  This checks the problem the paper found in the Data Visualization course [§5.4].
- **Learning:** stars and words learned in the teacher view, compared with a short test before and after the unit,
  which the paper lists as missing [§6.1].
