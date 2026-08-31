# Stepping Stone

Takes someone from "I don't know where to start" to a real first action. It
researches the specifics and hands over one concrete step at a time. Not a habit
tracker.

This repo is the **job-search vertical**, built end to end. The other categories
in the spec (sport or hobby, small business) are not built yet; the classifier
recognises them and says so.

## Running it

```bash
npm install
cp .env.example .env.local   # then put a real key in it
npm run dev
```

`ANTHROPIC_API_KEY` is the only environment variable. Get one from
[console.anthropic.com](https://console.anthropic.com). In production it is set
in the Vercel project's environment variables, and a new deployment is required
before a changed value takes effect.

## How the loop works

1. **Intake** — one text box, freeform.
2. **Classify** — sorts the input into a category. Only `job_search` has a
   downstream flow today.
3. **Questions** — the five fixed axes from the spec, reworded for whatever the
   person typed. Option ids are fixed in `src/lib/job-search-spec.ts` because the
   branching keys off them: no CV skips the target-role question.
4. **Plan** — returns the *arc* only. Titles and intent, no prose.
5. **Steps** — each one is written at the moment it is revealed, holding the
   goal, the answers, every reported outcome, and the CV.

That last point is the whole design. A plan written in one shot can only be a
to-do list, because every step after the first is authored before anything has
happened. Step two reads the CV that step one produced.

Ticking a step asks how it went, and that answer feeds the next generation, so a
step that failed gets a different route rather than the same advice again.

## The CV builder

Step one produces the artifact the rest of the plan runs on, so it has to help
make it rather than describe it. Two ways in, both ending with a saved CV:

- **Write it for me** — upload an existing CV, or answer a short interview if
  there isn't one.
- **Guide me** — moves specific to their situation, a handoff to flowcv.com, then
  upload the finished file.

PDFs are passed to Claude as a document rather than through a text extractor, so
multi-column layouts survive. `.docx` goes through mammoth.

Craft rules are ported from the cv-tailor skill: Google XYZ bullets, bullet
counts by recency, ATS-safe contact line, and no invented metrics. Where a number
is missing it leaves a bracketed placeholder and lists it under `gaps`. That
reconciliation happens in code, in `src/app/api/cv/write/route.ts`, because the
model does not do it reliably on instruction alone.

## Layout

```
src/app/            landing, /start, /questions, /plan
src/app/api/        classify, questions, plan, step, cv/{interview,write,guide}
src/components/     ui, marks (the hand-drawn SVGs), cv-builder
src/lib/            schemas, model + prompts, job-search-spec, session, cv-upload
```

`src/lib/schemas.ts` carries a length convention worth reading before editing it:
`.describe()` sets the target, `.max()` is only a runaway guard. A `.max()` set at
the target turns a slightly long sentence into a failed generation.

## State

There is no database. A run lives in `sessionStorage` and dies with the tab.
Registration (screen five of the design) is deliberately not built yet.

## Stack

Next.js 16, Vercel AI SDK with `@ai-sdk/anthropic`, Claude Opus 5, Zod, Tailwind
4. Visual direction follows the Claude Design handoff: ledger ground, biro blue
accent, Bricolage Grotesque over Figtree with Caveat for margin notes.
