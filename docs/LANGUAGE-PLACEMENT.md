# Language placement — CEFR diagnostic v1

## Product rule

Initial placement is not a mastery exam. The 90% rule belongs exclusively to
post-teaching lesson/module mastery and the existing canonical mastery gates.
No placement score, self-estimate, conversation or UI action publishes a
`LearningCompletion` or a mastered notion.

The interface shows Beginner, Intermediate or Advanced from the server's
diagnostic result. The declared CEFR, diagnostic observations and strict CEFR
certification remain separate fields.

## Existing services, no migration

- One owner/profile-scoped `ExperienceSession`, intent `language-placement`,
  stores a versioned cursor and up to three Assessment references.
- The existing Examiner creates questions and evaluates answers. Existing
  Assessment/AssessmentSubmission claims persist the questions, answers,
  feedback, diagnostic observations and replay identity.
- Profile and Learner Passport projections re-read canonical submissions,
  including the detailed skills, rounds, reasons and actual answer quotations.
  Cached completion flags cannot grant placement without these submissions.
- Generic session writes and generic assessment submission cannot fabricate or
  overwrite these domain-owned decisions.

## Progressive diagnostic

Self-estimation offers zero, basics, communicate, fluent or unknown. It never
skips the first round or awards a level.

The written diagnostic assesses vocabulary, grammar, reading and writing
separately. Rounds cover PRE_A1–A2, B1–B2, then C1–C2. Another round is offered
only if all four skills demonstrate the current ceiling. Generating that round
requires an explicit user action; reading/reloading never calls a provider.

Each round's global result is the minimum of its four required skills, never an
average or a numeric score threshold. The final result retains the highest
complete consensus actually demonstrated, not a mixture of best individual
skills across rounds. A harder follow-up cannot erase an earlier demonstrated
consensus. Missing or technically unevaluable evidence cannot finish a round.

PRE_A1 remains PRE_A1 in the diagnostic. Its curriculum entry is A1, which does
not manufacture an acquired A1 level. Listening/speaking are explicitly not
measured by this written diagnostic; it is not an official CEFR certification.
Acoustic pronunciation assessment and its existing capability locks are unchanged.

## Course continuity

New courses require a completed diagnostic before their first lesson. Their
entry level and teaching difficulty use the demonstrated result, not a stronger
self-declared level. Existing courses remain resumable without forced placement
or loss of previous learning evidence.

## Safety and validation

Generation and submission keys are stable per owner/session/round/assessment.
Identical requests recover persisted results; changed answers conflict rather
than awarding duplicate credit. Invalid, incomplete or fabricated provider
evidence is not converted into a default A1 or a failed mastery score.

Calls use the existing central provider, quota reservation and cost metering as
`language-placement` / `LANGUAGE_TEXT` / `AI_TEXT`, with no automatic retry.
Automated tests use in-memory fixtures, not real providers. The three-round path
can require six provider calls; it must not be attempted inside a five-call real
acceptance budget. Higher rounds are covered deterministically unless separately
authorized and budgeted.

This change is the placement foundation only. It does not claim completion of
the separate eleven-module catalogue or lesson-copilot work.
