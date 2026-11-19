# Exam Ready: "Am I ready for my German A1 exam?"

A web app for learners who have finished A1 and are about to book the Goethe or ÖSD exam. It answers one question: **"If I booked the exam today, would I pass?"**

The learner gets a **chance of passing** with a clear decision (Ready / Almost / Not yet), a **score per skill** with an honest range, **eight "I can…" markers**, the **2–3 things to practise**, and a **day-by-day plan** if they enter their exam date.

The front end and the back end both serve one idea: **a readiness score is only worth showing if you can check that it is right.**

| Front end (what the learner does) | Back end (what makes the score checkable) |
|---|---|
| Answers 15 questions, one at a time, with Back and keyboard keys | Questions come from the server **without the answer key**, so nobody can read the answers from the page |
| Sees chance of passing, ranges, markers, plan | **All scoring happens on the server**, so there is one source of truth and the rules can change without a new release |
| Gets a **link to their result** and can reopen it later | Every attempt is **stored anonymously** (no name, email, IP or exam date) |
| Says "feels right?" and later "I passed / didn't pass" | That feedback is saved against the attempt |
| Sees "how you compare" once enough learners have taken it | `/insights` turns it all into **calibration** (predicted vs actual pass rate) and **question health** |

## Run it

```bash
node server.js            # http://localhost:8000  (needs Node 18+, no installs)
npm test                  # 14 scoring tests + 7 API tests
```

Locally, data is saved to `data/store.json` (git-ignored).

## Structure

| Path | What it does |
|---|---|
| `public/` | The front end: `index.html`, `app.js`, `styles.css`, and `insights.html` (the team's accuracy dashboard). Nothing secret lives here. |
| `lib/questions.js` | The 15 questions, answers, difficulty, topics and "I can…" markers. **Server only.** |
| `lib/scoring.js` | The readiness calculation and the study plan. Pure functions. **Server only.** |
| `lib/handlers.js` | The API: `questions`, `score`, `result`, `feedback`, `insights`. Validates all input. |
| `lib/store.js` | Storage. Redis over REST when configured, a JSON file otherwise. |
| `api/*.js` | One-line Vercel functions that call `lib/handlers.js`. |
| `server.js` | Local dev server that runs the same handlers. |
| `test/` | Scoring tests and API tests (answer key never leaks, bad input rejected, calibration works). |
| `NOTE.md`, `VIDEO_SCRIPT.md` | Written note and video outline. |

## How "ready" is decided

I looked at how real exams and readiness tools work first:

- **The exam itself.** Goethe-Zertifikat A1 *Start Deutsch 1* is passed with at least **60% of the total points** (all parts taken). Sources describe it as not modular; the per-module 60% rule applies to B1 and above. I could not confirm the ÖSD A1 rule from an official source, so the app uses the Goethe rule and says so.
- **Readiness predictors** such as UWorld's NCLEX "chance of passing" report a *probability*, not a raw percentage. UWorld says it uses a statistical model (Item Response Theory). That is the idea I borrowed.
- **CEFR "can-do" statements** describe A1 ability as "I can…". They are the model for the markers.

So the score works like this:

1. **Evidence.** Each question counts by difficulty (easy 1, medium 2, hard 3). "I don't know" counts as wrong, but it stops people guessing.
2. **Skill estimate with uncertainty.** A Beta distribution turns each skill's answers into an estimate and an 80% range. Five questions per skill is a small sample, so the range is wide, and the app shows it.
3. **Overall ability.** Reading 40%, grammar 30%, vocabulary 30%, combined with their uncertainty.
4. **Chance of passing.** The probability that the learner's true level is at or above the 60% pass line.
5. **Decision.** 85% or more is *Ready*, 60–84% is *Almost ready*, below 60% is *Not ready yet*. The bar for "Ready" is high on purpose: a wrong "ready" costs an exam fee and months; a wrong "not yet" costs a couple of weeks. In practice about 13 of 15 correct is needed.
6. **Safety rule (my design choice, not an exam rule).** A skill under 40% blocks "Ready", because listening, writing and speaking lean on the same words and grammar and this check can't see them.
7. **Markers and advice.** Each topic is a marker. Points lost per topic are added up, and the top 3 topics become the advice.

Example results (from the tests): 15/15 gives 99%; 13/15 gives 88%; 11/15 gives 47%; 10/15 gives 26%.

## How we find out if it is right (the feedback loop)

Open `/insights.html` (linked from the footer). It shows:

- **Calibration:** learners grouped by the chance we gave them, next to how many really passed. If we say 85%, about 85% should pass.
- **Question health:** questions almost everyone gets right or wrong, or that many skip, are flagged after 20 attempts.
- **Feel-right split** and the number of real exam results reported.

Real exam results arrive when learners reopen their saved result link after the exam and tap "I passed / I didn't pass".

## Deploy (Vercel)

1. Push this folder to GitHub, then import the repo in Vercel (no build settings needed; `vercel.json` points to `public/`).
2. **Add storage so data is kept.** In Vercel: Storage → Marketplace → *Upstash Redis* → connect to the project. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`, and the app picks them up automatically.
   Without it the app still works, but results are saved to temporary storage and can disappear. The insights page says when that is the case.

## What it does not do (yet)

- It does not test listening, writing or speaking, and says so on the results page.
- The 60% line, the weights and the 85/60 cut-offs are reasoned estimates, not fitted to real exam results. The feedback loop above is how they get fitted.
- There is no rate limiting or admin login. Insights are aggregate only (no individual attempts), but add both before real traffic.

## Sources

- [Goethe-Institut: Start Deutsch 1 information](https://www.goethe.de/ins/rw/en/spr/prf/gzsd1.cfm)
- [Goethe-Institut: information on the exam results](https://www.goethe.de/en/spr/prf/pes/pas1.html)
- [UWorld: how its NCLEX readiness score is interpreted](https://nursing.uworld.com/blog/what-is-a-good-uworld-nclex-score-interpreting-your-uworld-nclex-score/)
