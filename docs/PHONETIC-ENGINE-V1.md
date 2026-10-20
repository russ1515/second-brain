# Phonetic Assessment Engine V1 — bounded readiness and evidence

Date: 2026-10-21. Scope: local English-first acoustic prototype, with an explicit
34-language capability boundary. This document does not authorize a VPS model
installation, deployment, paid provider call, subscription or mastery activation.

**Current Phase H checkpoint:** see section 10. Earlier test counts, delivery
status and missing UI descriptions in sections 1–9 are the retained A–G audit
record, not the current Phase H verdict. Phase H authorizes commit/push and only
conditionally permits beta deployment. Its acceptance conditions have **not**
passed: the weak-phoneme detector is unreliable and real microphone/PostgreSQL
acceptance is unverified. Do not deploy this capability on that evidence.

## 1. Product boundary

- `PRACTICE_ONLY`: existing listening, TTS, STT, microphone, repetition, shadowing
  and speaking practice remain available. STT is not pronunciation evidence.
- `ACOUSTIC_UNCALIBRATED`: real audio, expected phones, alignment and acoustic
  measurements exist for the exact engine/model/locale tested. There is no
  validated pedagogical 0–100 score and `masteryEligible` remains false.
- `CALIBRATED_MASTERY`: requires a separately validated human calibration and
  language/locale allowlist. Only this state may contribute to the existing
  >=90% mastery rule.

Unavailable or uncalibrated assessment is not learner failure. Preserve
`MASTERY_NOT_VERIFIED` / `NOT_EVALUABLE`; do not block unrelated text learning.
No forced alignment, recognizer confidence or LLM opinion may silently become
a pronunciation percentage. No existing lesson/placement/workspace engine is
replaced by this prototype.

Reference deliveries preserved: API
`f4837bbbce803f29e9dcddc3e37bea965f6d87a1`, User
`4174cacff1ed1294c1cfe3ef07230f720243909c`.

## 2. Infrastructure observations and bounded operating proposal

The following observations were supplied by the targeted read-only runtime audit
for this task; they are not a load-test or a reservation of free capacity.

| Resource | Observed |
|---|---|
| VPS CPU | 6 Haswell-class logical cores, AVX2 |
| VPS RAM | 11,671 MiB total; 7,945 MiB available at observation |
| VPS swap | 0 |
| VPS root filesystem | 96 GiB total; 82 GiB used; approximately 15 GiB free |
| Docker images | 71.07 GB reported by Docker; shared-layer accounting is not additive with `df` |
| Docker build cache | 7.435 GB |
| Docker volumes | 608 MB; preserve all persistent data |
| Containers | 27 active; 83 total |
| VPS Python | Host Python 3.14.4 |
| VPS ffmpeg | Not found by this audit |
| GPU | No compute GPU confirmed; no NVIDIA tooling found |
| Local development runtime | Python 3.12 and NumPy available; approximately 102 GB disk free |

Proposal, **not a VPS capacity validation**: start with one bounded CPU worker,
a 512 MiB memory ceiling, and <=250 MB of prototype model/dependency artifacts.
The local six-case run peaked at 161,726,464 bytes of worker memory. The isolated
installed dependency is 39,162,051 bytes (28 files); bundled models/lexicon/language
model together occupy 37,989,705 bytes. Measure the complete dependency
footprint and production headroom before any VPS decision. Do not load a multi-GB
neural checkpoint into the running API.
Do not assume the host Python version is compatible with a future binary wheel.
If those measured bounds cannot preserve API/User headroom, report
`DEDICATED_ACOUSTIC_INFERENCE_REQUIRED`, rather than weakening production guards.

The six local technical cases measured a 12,421.5 ms median wall time, including
one immediate silence rejection. This small, heterogeneous synthetic sample has
**no representative p95** and is not a production latency guarantee. Keep CPU
time, wall time, model initialization and cold/warm runs distinct. It does not
establish a three-second narration or interactive-acoustic response target.

The private Node boundary has a 60-second wall timeout and 4 MiB input limit.
The Python CLI declares POSIX limits of 25 CPU seconds and 512 MiB address space;
the local Windows run does not demonstrate a hard memory cap. No inference was
installed on the VPS to test these bounds there.

## 3. Minimal integration architecture

Reuse the existing provider-independent acoustic contract and canonical evidence
bridge. A Node orchestrator may invoke a private, bounded Python subprocess for
the local prototype; it needs no listening public port and remains disabled in
production until explicitly approved and validated. It must not become a second
grading, quota or progression engine.

The intended evidence flow is:

`validated audio -> expected phones -> alignment -> raw acoustic evidence`
`-> word/phone observations -> bounded remediation -> canonical assessment`

Keep preprocessing, expected-phone lookup, acoustic alignment, diagnosis and
calibration as distinct responsibilities. Use an explicit capability registry;
never route every language through an English model or infer capability from UI
translation coverage.

Safety requirements for the subprocess boundary:

- No shell interpolation of user text, model path or audio filename.
- Allowlisted executable/model, bounded audio bytes/duration and execution time.
- Validated mono PCM input, finite samples and recorded sample rate/timing.
- Reject corrupt/empty/silent or unsupported recordings without an invented score.
- Clean temporary audio and never place raw learner recordings or secrets in logs.
- Keep engine/model/lexicon/phone-inventory versions and evidence hashes explicit.
- Production default remains off; no database migration, subscription or paid
  resource is necessary for the local prototype.

## 4. English candidate: what is and is not established

The proposed lightweight baseline is PocketSphinx with its bundled US English
acoustic model and CMU pronunciation dictionary. The upstream package is not a
34-language acoustic bundle; its default model is explicitly US/Canadian English.
An unspecified `en` request must resolve to an explicit, recorded locale policy,
not falsely claim validation for every English accent. See the
[PocketSphinx installation documentation](https://pocketsphinx.readthedocs.io/en/latest/).

CMUDict supplies a lexicon and a
[39-base-phone inventory](https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.phones),
not an unrestricted generative G2P. Expected phones can be looked up for covered
words with supported pronunciation variants. Unknown words, unsupported phones,
ambiguous cases without a supported policy and mismatched locales must remain
explicitly unevaluable instead of guessed. Dictionary coverage is not proof that
the learner pronounced the word correctly.

PocketSphinx exposes word/phone/HMM-state alignments and raw acoustic log scores.
These are **not GOP**, not phoneme correctness probabilities and not a calibrated
pronunciation-quality percentage. A forced alignment constrains the expected
phones and does not, by itself, prove substitutions or omissions. Competing-phone
diagnoses require a real acoustic comparison and their own validation. See the
[alignment API](https://pocketsphinx.readthedocs.io/en/latest/pocketsphinx.html).

Local execution used pinned PocketSphinx **5.0.4** with Python 3.12. The initially
examined 5.1.1 package had no compatible Windows/Python 3.12 wheel for this run;
the selected binary's actual alignment API was exercised rather than assuming
latest-documentation compatibility. English real acoustic-model execution is
locally `ACOUSTIC_UNCALIBRATED` for the tested en-US reference cases. This does
not imply calibrated pronunciation accuracy or learner validation. Model hashes
and the installed footprint are recorded in the retained local artifact report.
The model fingerprint is `1d60fb00c87c143d94a49ebd275f4aeec78996596b183655b8d01c3cdab20870`;
the lexicon fingerprint is `b5ef92f6b9584f30fb8552acce799e5ff432d0b19bd81488a9a6b20a6bd2d644`.
Prosody, human calibration and mastery
eligibility remain missing.

## 5. Full 34-language matrix

The registry is `packages/shared/src/languages.ts`, with exactly 34 product
entries. `no` is a read alias of `nb`, not another choice. `zh-Hant` is a script
entry: spoken locale still needs an explicit policy and its own validation.

**Table semantics:** the six component columns below mean **proven local
prototype availability**, not upstream package marketing. `MISSING` includes a
component not yet installed, integrated and validated. The English G2P cell means
covered-word lexicon lookup only, not full OOV G2P. One local English entry is
`ACOUSTIC_UNCALIBRATED`; the other 33 remain `PRACTICE_ONLY`. The deployed reference
is unchanged: all 34 production entries remain `PRACTICE_ONLY` for this new
engine, with zero validated deployment. No row claims calibrated mastery.
TTS/STT availability is intentionally excluded from acoustic availability.

Groups describe candidate engineering effort, not the universe of existing
research resources:

- **A (1)**: English baseline assets identified for the proposed PocketSphinx stack.
- **B (23)**: corresponding MFA acoustic/dictionary assets identified upstream;
  matching models, G2P/lexicon, phoneset and an aligner adapter still needed.
- **C (8)**: no acoustic asset identified in that MFA catalogue; a compatible,
  appropriately licensed checkpoint/data path still needs identification.
- **D (2)**: low-resource candidates needing dedicated lexicon/inventory/data and
  linguistic work. Absence from the checked catalogues is not proof of universal
  unavailability.

Upstream shorthand: **CMU** = covered-word lexicon and inventory; **MFA** =
language-specific dictionary/model phoneset candidate; **ES** = development
eSpeak G2P candidate, not a validated acoustic model. None implies installation.

| Language | Group | Upstream G2P / inventory candidate | G2P | Phoneme inventory | Alignment | Acoustic foundation | Prosody | Calibration data | Local capability |
|---|---|---|---|---|---|---|---|---|---|
| `fr` French | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `en` English | A | CMU covered-word lexicon / PocketSphinx 5.0.4, en-US | AVAILABLE (LEXICON_ONLY) | AVAILABLE | AVAILABLE | AVAILABLE | MISSING | MISSING | ACOUSTIC_UNCALIBRATED |
| `es` Spanish | B | MFA / ES; select dialect | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `de` German | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `it` Italian | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `pt` Portuguese | B | MFA / ES; select PT/BR locale | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `nl` Dutch | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `pl` Polish | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `ru` Russian | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `zh` Chinese, Simplified | B | Mandarin MFA / ES `cmn`; locale policy required | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `ja` Japanese | B | MFA / ES; ES script limitation | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `ko` Korean | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `ar` Arabic | C | MFA dictionary / ES; diacritization required by ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `hi` Hindi | C | MFA dictionary / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `tr` Turkish | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `sv` Swedish | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `vi` Vietnamese | B | MFA / ES; select dialect, validate tones separately | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `th` Thai | B | MFA / ES; segmentation and tones require validation | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `el` Greek | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `cs` Czech | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `ro` Romanian | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `hu` Hungarian | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `da` Danish | C | ES; compatible acoustic candidate not identified here | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `fi` Finnish | C | ES; compatible acoustic candidate not identified here | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `id` Indonesian | C | MFA dictionary / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `nb` Norwegian Bokmål | C | ES `nb`; no duplicate `no` | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `uk` Ukrainian | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `ln` Lingala | D | No candidate identified in checked MFA/ES catalogues | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `sw` Swahili | B | MFA / ES | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `wo` Wolof | D | No candidate identified in checked MFA/ES catalogues | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `ha` Hausa | B | MFA dictionary and matching inventory | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `he` Hebrew | C | ES; compatible acoustic candidate not identified here | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `zh-Hant` Chinese, Traditional | B | Mandarin/Taiwan MFA candidate; script is not dialect | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |
| `bn` Bengali | C | ES; compatible acoustic candidate not identified here | MISSING | MISSING | MISSING | MISSING | MISSING | MISSING | PRACTICE_ONLY |

The B-group evidence is the primary
[MFA acoustic catalogue](https://mfa-models.readthedocs.io/en/latest/acoustic/index.html)
and [pronunciation dictionary catalogue](https://mfa-models.readthedocs.io/en/latest/dictionary/index.html).
These models are not drop-in PocketSphinx files. ES entries come from the
[eSpeak development language list](https://raw.githubusercontent.com/espeak-ng/espeak-ng/master/docs/languages.md);
the installed version must be checked separately. Its documented Arabic support
requires full diacritics; Japanese support is limited to hiragana/katakana.
Neither scripts, G2P nor forced alignment establish tone/prosody correctness.

## 6. Licensing and artifact controls

For the English candidate, retain all applicable copyright and redistribution
notices. The code, bundled acoustic model and dictionary are separate artifacts:

| Artifact | Verified upstream terms | Primary source |
|---|---|---|
| PocketSphinx code | BSD-style, commercial redistribution allowed subject to notices | [LICENSE](https://raw.githubusercontent.com/cmusphinx/pocketsphinx/main/LICENSE) |
| Bundled English acoustic model | BSD-style, Alpha Cephei notices | [model README](https://raw.githubusercontent.com/cmusphinx/pocketsphinx/main/model/en-us/en-us/README) |
| CMUDict | BSD-style; preserve CMU notice | [LICENSE](https://raw.githubusercontent.com/cmusphinx/cmudict/master/LICENSE) |

Before any VPS installation approval, record exact package/model versions, immutable
download references, hashes, measured bytes and notices. An upstream repository
license does not automatically cover every separately downloaded weight file.

Possible later alternatives, **not installed or selected for V1**:

- MFA code is [MIT](https://raw.githubusercontent.com/MontrealCorpusTools/Montreal-Forced-Aligner/main/LICENSE).
  Check each model/dictionary license independently: catalogue entries include
  CC0 and CC BY 4.0. The
  [English MFA v3.1.0 model](https://mfa-models.readthedocs.io/en/latest/acoustic/English/English%20MFA%20acoustic%20model%20v3_1_0.html)
  is CC BY 4.0, intended for alignment rather than calibrated learner grading.
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng) and
  [Phonemizer](https://github.com/bootphon/phonemizer) are GPL-3.0; evaluate the
  integration/distribution obligations rather than labelling the whole stack BSD.
- Meta's [phoneme Wav2Vec2 checkpoint](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft/raw/main/README.md)
  is Apache-2.0 and accepts 16 kHz speech, but its footprint, per-language behavior
  and deployment safety are not validated here. Do not download it blindly.
- [MMS-1B-all](https://huggingface.co/facebook/mms-1b-all/raw/main/README.md)
  is CC BY-NC-4.0. Broad ASR language coverage does not establish commercial-use
  permission, compatible phonetic scoring or calibrated mastery. It is not an
  approved shortcut for Lingala/Wolof.

## 7. Evidence, local tests and calibration gate

Local acceptance must separate deterministic contract tests from real acoustic
execution. Synthetic fixtures may test parsing/silence/corruption handling but
must never be described as real learner acoustic-quality validation. Record:

1. Actual audio provenance/consent, format, duration and hash; no raw audio in logs.
2. Expected lexicon phones and supported variants, without guessed unknown words.
3. Model/version/hash and real word/phone alignment with bounded finite timings.
4. Raw acoustic scores under an explicitly named metric, not a disguised 0–100.
5. Silence, noise, wrong-utterance, truncation and unknown-word rejection behavior.
6. Deterministic result normalization, canonical evidence integration and
   idempotence without progress credit for uncalibrated results.
7. Preservation of existing TTS/STT, practice, placement and mastery logic.
8. Actual cold/warm duration, artifact size and peak memory for the local prototype.

### Local execution evidence

The following six recordings were generated with Windows SAPI en-US for technical
testing and processed by the **actual PocketSphinx 5.0.4 acoustic model**. They are
not human learner recordings, calibrated pronunciation errors or a substitute
for accent/microphone validation. Recognition counts are secondary ASR evidence,
never phonetic scores or recognition-confidence grades.

| Case | Observed result | Wall ms | CPU ms | Peak worker bytes |
|---|---|---:|---:|---:|
| Reference phrase | EVIDENCE_AVAILABLE; 4 aligned words, 12 phones; secondary ASR 4/4 | 21,016 | 1,953.125 | 157,532,160 |
| Truncated utterance | NOT_EVALUABLE alignment; secondary ASR 2/4 and two tentative omissions retained | 13,765 | 1,890.625 | 159,428,608 |
| Different phrase | Acoustic evidence available; secondary ASR 0/4 and four tentative substitutions, **not a phonetic accuracy verdict** | 11,078 | 1,718.750 | 161,165,312 |
| Noise | NOT_EVALUABLE | 19,219 | 3,531.250 | 161,726,464 |
| Silence | NOT_EVALUABLE, AUDIO_SILENT | 0 | 0 | Not separately reported |
| Added pause | Acoustic evidence available; measured internal gap 2,030 ms | 7,297 | 2,343.750 | 161,726,464 |

Technical-case median wall time: **12,421.5 ms**, n=6, including immediate rejection.
No representative p95 is reported. A wrong phrase can still be force-aligned to
the expected sequence: this explicitly demonstrates why aligned phone names or
raw likelihoods do not certify that the learner produced those phones.

Python local suite after artifact fingerprints: **29/29 PASS**. Shared/API first-pass regressions were
**42 PASS / 71 PASS** before the final evidence-schema/tokenization/timing
hardening; these are historical first-pass results, not an assertion that the
changed boundary has already passed its final rerun. Record the root's final
targeted regression result separately when available. No paid provider call was
made by the local engine.

Final targeted coverage: **23/23 API phonetic tests**, **6/6 shared phonetic
tests**, plus the previously passed 54 API and 38 shared non-regression cases
whose implementation did not change in the last feedback-only patch. Python is
**29/29 PASS**. The actual Node -> private Python CLI reference test is
**1/1 PASS**, with 4 words, 12 phones, model/lexicon fingerprints and all
pedagogical scores null. Its latest observed wall time is **5,594 ms**, including
child startup; worker total **4,797 ms**, CPU **1,843.75 ms**, secondary ASR
**1,672 ms**, alignment/score extraction **453 ms**. Upload latency and public
microphone latency are **NOT_VERIFIED**. Preprocessing and score extraction do
not yet have independently instrumented production spans.

Final shared build, API build/typecheck and User typecheck are **PASS**. The API
projection's explicit unknown-to-string narrowing was repaired before the final
successful compilation; no emitted-JavaScript-only test is used as typing proof.
A test-fixture-only Resume failure (`links` missing in a mock) was corrected
without changing Workspace code. The final shared feedback templates cover
34 codes x 5 templates, with target words preserved. Native human review of this
new copy is NOT_VERIFIED.

### Persistence and public validation boundary

Experimental attempts use the existing server-owned `ExperienceSession` JSON
envelope with owned lesson/profile/version references and idempotency. This is
**zero migrations**. It does not manufacture an `AssessmentSubmission` numerical
zero, mastery proof, `LearningCompletion` or 90% unlock. The existing calibrated
acoustic provider remains unbound. `bestMasteryScore` stays null; no weak-phoneme
ranking is derived from incomparable likelihoods. Word/phrase omissions or
substitutions are only tentative secondary-ASR observations; observed/alternative
phoneme identity and reliable phonetic correctness remain unavailable.

No public-browser microphone/audio-recording path has been validated for this
new engine. No VPS acoustic runtime has been installed or deployed. UI integration,
real learner audio, human calibration and production latency remain unverified.
Code is local and uncommitted/unpushed at this checkpoint; the public API/User
source SHAs listed above remain the reference deliveries, not a new deployment.

The readable deterministic feedback uses the existing
`resolveLanguageTeachingRoles` policy and snapshots its support language in the
owned attempt. Tests cover French UI/English target and Lingala native support
despite French UI; target words are not translated. This is backend feedback,
not proof of rendering in the Professor screen. Reliable weak-phoneme detection
and contrastive diagnosis are still missing; raw likelihoods are not used to
invent them. Full PostgreSQL persistence/reconnection and real browser microphone
acceptance of this new engine are NOT_VERIFIED (persistence tests use isolated
in-memory stores).

Privacy: the Python child receives audio through private stdin and retains it
only in memory; no temporary learner-audio file is created. The API does not
persist audio or secondary-ASR transcripts/observed words, only bounded acoustic
metrics and expected-word mismatch indexes. Nested provider bodies, arbitrary
secrets and grades are stripped by a field-level whitelist. Synthetic technical
WAV fixtures used for this audit are outside the Git worktree. A crash after a
durable claim can leave a `processing` attempt: the same key never reruns
inference automatically; an explicitly new attempt uses a new key. Automatic
stale-claim reconciliation is not implemented and must not be claimed.

Calibration requires a separate consented and licensed dataset: diverse speakers,
accents, target levels, microphones, recording conditions and real learner errors;
independent human phonetic/intelligibility ratings; held-out speakers; explicit
inter-rater agreement, error analysis and false acceptance/rejection criteria.
Keep accent diversity separate from intelligibility or error: a different accent
is not automatically a mistake. Validate phone, word and phrase criteria, and
document which dimensions cannot be measured reliably. Protect retention/deletion
and user isolation throughout. Do not invent a corpus-size requirement or pass
threshold without evidence and product approval.

Until that work passes for a specific locale/model/version, confidence is only
technical evidence confidence, not learner mastery. `calibrationStatus` remains
uncalibrated, pedagogical scores remain absent, `masteryEligible=false`, and the
90% pronunciation mastery gate stays closed. Prosody must stay unavailable unless
measured by a validated component; STT never substitutes for it.

## 8. Delivery boundary

This task permits audit, bounded implementation and local tests. It does not
implicitly authorize a VPS installation, new public port, concurrent deployment,
database migration, Azure activation or subscription. Preserve existing running
images, rollback, private configuration, persistent data and unrelated Workspace
work. Report local results and limitations before seeking any production change.

## 9. Final status and changed files

| Requested field | Verified result |
|---|---|
| Second Brain Phonetic Engine | PARTIAL_PASS: real local English acoustic observations; not a certified pronunciation-quality engine |
| Infra audit | PASS, read-only; no service restart or VPS model installation |
| Dedicated inference required | NO for the measured bounded CPU prototype; production concurrency/SLO NOT_VERIFIED |
| Engine contract / capability registry / 34-language matrix | PASS |
| English G2P | PASS for CMUdict-covered targets only; OOV NOT_EVALUABLE |
| English phoneme inventory | PASS, broad stressless reference IPA; no inferred observed phoneme |
| Audio preprocessing | PASS for bounded PCM WAV; real WebM/MP4 conversion NOT_VERIFIED |
| English alignment / phoneme acoustic evidence / word aggregation | PASS, raw expected-phone HMM evidence, not GOP or pronunciation accuracy |
| Completeness | PASS as tentative secondary-ASR omissions/mismatch; not phonetic evidence |
| Fluency | PASS for observed timing/long-pause signals, not calibrated fluency grading |
| Prosody | NOT_IMPLEMENTED |
| Score normalization | PASS as technical per-frame raw metric; cross-phoneme comparison forbidden |
| Calibration / mastery eligibility | NOT_CALIBRATED / NO |
| English capability | ACOUSTIC_UNCALIBRATED locally; public runtime remains PRACTICE_ONLY |
| Professor feedback / targeted remediation | PASS deterministic backend word/phrase descriptors and support-language text; UI and reliable weak-phoneme diagnosis NOT_VERIFIED |
| Passport integration | PASS deterministic backend projection/ownership/idempotence/delete/reset tests; actual PostgreSQL acceptance NOT_VERIFIED |
| Real microphone | NOT_VERIFIED |
| Raw learner-audio retention | No disk or database retention; private transient processing only |
| Models / licence | PocketSphinx 5.0.4 + shipped en-US HMM + CMUdict; COMMERCIAL_USE_OK under the linked BSD-style notices |
| Installed footprint | 39,162,051 bytes total; model bundle 37,989,705 bytes |
| Memory | Observed peak 161,726,464 bytes; not a concurrency guarantee |
| CPU | Maximum observed 3,531.25 ms per synthetic technical case |
| Observed latency | Six-case median 12,421.5 ms; latest private Node/CLI reference 5,594 ms; no representative p95 |
| 34 local languages | CALIBRATED_MASTERY 0; ACOUSTIC_UNCALIBRATED 1; PRACTICE_ONLY 33 |
| 34 public languages | No new acoustic capability deployed; calibration 0/34 |
| 90% pronunciation mastery enabled | NO |
| Migrations / paid LLM calls / new paid-provider cost | 0 / 0 / USD 0 |
| New commits / push / deployment | None; local implementation only |
| Old API SHA | f4837bbbce803f29e9dcddc3e37bea965f6d87a1 |
| Old User SHA | 4174cacff1ed1294c1cfe3ef07230f720243909c |
| Public beta | Existing site and /api/health HTTP 200; new engine NOT_DEPLOYED |
| Rollback ready | YES: running images/configurations and existing rollback untouched |

24 scoped source/documentation/test files (the two pre-existing Workspace diffs
are excluded and their Git blob hashes remain unchanged):

```text
apps/api/src/experience-sessions/experience-session.service.ts
apps/api/src/languages/dto/create-phonetic-attempt.dto.ts
apps/api/src/languages/language.module.ts
apps/api/src/languages/phonetic-assessment.engine.ts
apps/api/src/languages/phonetic-attempt-projection.ts
apps/api/src/languages/phonetic-attempt.controller.ts
apps/api/src/languages/phonetic-attempt.service.ts
apps/api/src/onboarding/learner-passport.service.ts
apps/api/test/learner-passport.test.cjs
apps/api/test/phonetic-attempt.test.cjs
apps/api/test/phonetic-engine.test.cjs
apps/api/test/phonetic-local-runtime.test.cjs
docs/PHONETIC-ENGINE-V1.md
packages/shared/src/index.ts
packages/shared/src/learner-passport.ts
packages/shared/src/phonetic-assessment.ts
packages/shared/src/phonetic-feedback-copy.ts
packages/shared/test/phonetic-assessment.test.cjs
services/phonetic-engine/README.md
services/phonetic-engine/phonetic_engine.py
services/phonetic-engine/requirements.txt
services/phonetic-engine/tests/audit_installed_artifacts.py
services/phonetic-engine/tests/run_local_acceptance.py
services/phonetic-engine/tests/test_engine.py
```

## 10. Phase H — real controlled execution and bounded product integration

### Controlled evidence, not pronunciation certification

Fifteen offline technical cases exercise five clean reference sentences, five
controlled contrast/final-ending alterations, a different phrase, a partial
phrase, an inserted pause, silence and deterministic noise. Windows SAPI en-US
produced the synthetic fixtures outside Git; no human learner audio or paid
TTS/LLM provider was used. Reproducible measurements are retained in the local
`deliverables/phonetic-phase-h-20261021/controlled-after.json` and
`controlled-summary.json` artifacts. This is not human calibration.

- Five clean references: zero invented phoneme warnings and zero tentative word
  warnings. This proves safe abstention, **not** that correct sounds are detected.
- Five alterations: **0/5 reliable localizations** of the manipulated sound.
  Secondary ASR sometimes replaces a word, sometimes normalizes the altered word
  to the reference. A deliberately omitted final /s/ is still forced into the
  expected alignment. Raw reference-phone timings cannot diagnose that omission.
- Wrong phrase: tentative word mismatch, never a phonetic correctness verdict.
- Partial phrase: two tentative omissions remain available after alignment fails.
- Inserted two-second pause: an observed 2,030 ms alignment gap, not a fluency grade.
- Silence: rejected. Noise: alignment fails closed; tentative ASR omissions are
  not confirmed learner weaknesses.

**WEAK PHONEME DIAGNOSIS = UNRELIABLE.** The private engine and the Node boundary
explicitly return `INSUFFICIENT_ACOUSTIC_CONFIDENCE`, null confidence, empty weak
phoneme/high-confidence issue lists and no mastery score. This remains true for
legacy engine responses omitting the diagnostic field and hostile adapters
claiming confidence. No contrast examples are hardcoded into production rules.

### Additive application path

- Reuses the existing recorder and explicit reference `SpeakButton`. No new
  recorder, automatic TTS, transcription-based pronunciation grade or LLM feedback.
- A separate, non-assessment practice panel is mounted only for an already
  authored `voice-pronunciation` exercise with `audioText`. It does not guess a
  reference from a quiz answer or alter the lesson/placement generator.
- An authenticated, ownership-checked capability request invokes a bounded
  no-audio Python readiness probe. Exact installed engine, model and dictionary
  fingerprints are verified; configured paths alone do not imply availability.
  The existing `PHONETIC_ENGINE_ENABLED` equivalent flag is off by default.
- Record → stop → explicit submit uses the existing multipart API. Distinct
  permission, empty/short/long, format, silence, alignment, confidence and engine
  errors are presented. Normal UI does not display raw likelihoods or a fake %.
- A word retry is restricted to an owned parent attempt and a server-derived
  tentative omission index. It is not a confirmed phoneme remedy. Comparison is
  limited to comparable reference/version/model observations; microphone
  comparability is explicitly false. No improvement becomes mastery.
- No auto retry or background practice loop. Screen changes/unmount invalidate
  late responses and release the existing recorder. One post-submit history read
  retrieves the server-owned comparison.
- The support language remains the existing resolver's snapshot; target phrases
  are preserved. The new UI copy has entries for all 34 supported codes. Native
  linguistic review is not proven by this technical coverage.

### Canonical persistence and acceptance limit

Attempts remain in the existing server-owned ExperienceSession envelope, with
profile/lesson/exercise/version, timestamp, engine/capability, calibration,
observations, null confidence, parent/relevant attempt references and bounded
history. No new schema or grade engine. Generic session mutations cannot forge
these envelopes. Idempotent claims prevent duplicate inference/credit; deletion
and learning-data reset continue to use the existing ownership/cascade paths.
An explicit recovery command can fail a stale (>120 s) processing claim without
rerunning inference. It cannot revive a deleted/reset attempt.

An opt-in PostgreSQL application-service test is supplied in
`apps/api/test/phonetic-postgres.integration.test.cjs`. It accepts only the two
previously authorized technical identities, validates their existing verified
account, English profile and authored voice exercise **before any write**, then
uses the canonical service and independent connection reads. It never creates
accounts, lessons, tokens, grades or schema and never claims a DB reconnect is
browser F5/JWT relogin.

The actual read-only staging query found **2 authorized technical accounts,
2 English profiles, 3 English lessons and 0 eligible authored voice references**.
No account or course was altered to manufacture this prerequisite. Therefore
real PostgreSQL attempt persistence, browser microphone, F5 and relogin for this
new capability remain **NOT_RUN/NOT_VERIFIED**. This is not a schema incompatibility
and does not justify a migration. No beta deployment is needed or allowed merely
to bypass these acceptance gates.

### Resources and privacy

Local loaded-Windows measurements (small synthetic samples, not VPS guarantees):

| Stage | n | Min / observed median / max |
|---|---:|---|
| Preprocessing | 15 | 0 / 156 / 625 ms |
| Secondary ASR + alignment | 14 | 6,125 / 8,070 / 21,765 ms |
| Worker total, including silence rejection | 15 | 0 / 17,593 / 30,047 ms |

Observed maximum worker memory: **160,743,424 bytes (153.3 MiB)**. Median CPU time:
**4,875 ms** per case. Separate bounded concurrency runs: one job 18.110 s/~152 MiB;
two jobs 19.860–20.359 s/~304.4 MiB summed process peaks; three jobs
32.438–33.235 s/~454.6 MiB summed process peaks. The three-job batch used
15.203 s CPU and 40.297 s wall. Summed peaks are a conservative upper bound, not
a measured simultaneous machine peak. No p95 is claimed.

The production-facing Node adapter admits **one** acoustic job, returning an
explicit busy result for the others, rather than an unbounded queue. Readiness
shares that slot and caches its bounded result for 60 s. Limits: 4 MiB upload,
150 ms–30 s input, 60 s Node child wall deadline, 20 s converter deadline, bounded
IPC/stderr, one thread per math runtime; the POSIX worker also declares 25 s CPU
and 512 MiB address-space limits. Windows measurements do not validate a VPS hard
memory ceiling. Inference is private stdin/stdout, no new listening port.

Learner audio stays in memory/anonymous pipes only. No temporary learner-audio
file is created: there is no disk recording to retain after success, failure or
timeout. No audio/transcript/observed words, secrets or arbitrary provider bodies
are serialized into the Passport. Synthetic fixtures are explicitly technical
test artifacts, not retained learner recordings. Browser blobs use the existing
recorder cleanup path; real-device cleanup still requires human acceptance.

### Phase I calibration plan — proposal only, no collection authorized

The optional normalizer was additionally exercised with locally encoded
WebM/Opus, Ogg/Opus and fragmented MP4/AAC: 8 conversion/bounds/error tests pass.
The two complete codec-to-model tests remain blocked by the local permission
boundary between the separately installed codec and PocketSphinx runtimes; this
is **not** a passing browser transport or microphone acceptance. The isolated
test binary is FFmpeg 7.1, obtained from the pinned `imageio-ffmpeg==0.6.0` Windows
wheel. Its wrapper is BSD, but this particular Gyan FFmpeg binary declares
`--enable-gpl --enable-version3`: it is a GPLv3 build. No redistribution or VPS
installation was performed; any future distribution must retain/review the
applicable binary notices/source obligations, not assume the wrapper's license.
See the [upstream packaging documentation](https://github.com/imageio/imageio-ffmpeg/blob/main/README.md).

Start with an exploratory **40-speaker pilot**: 10 reference speakers spanning
relevant English varieties and 30 adult learners balanced across several native
language families and beginner/intermediate/advanced levels. This is a planning
sample, not a statistically certified minimum or permission to collect minors'
voices. Review power, coverage and subgroup sizes before any mastery claim.

Propose 24 short utterances per speaker, recorded in two conditions (up to 1,920
clips): cover the 39 base reference phones, minimal contrasts, vowels, voiced and
unvoiced consonants, clusters, final inflections, connected speech, omissions and
pauses. Use naturally occurring learner errors as well as explicitly instructed
controlled contrasts. Do not penalize an intelligible accent or equate synthetic
alterations with human error. Include phone/laptop/headset microphones, quiet and
ordinary moderate-noise environments, recording codec and device metadata.

Two independent trained annotators plus adjudication should label segment/word
correctness, acceptable accent variants, supported omission/substitution, acoustic
uncertainty, intelligibility and observable pauses separately. Prosody remains
unimplemented until a validated component exists. Store disagreements and
unrateable clips, not a forced zero; quantify agreement and analyze error types.

Proposed dataset schema: pseudonymous speaker/clip IDs, explicit consent/license
and retention policy, locale/L1/level/condition metadata, authorized audio hash and
storage reference, expected text/phones, engine/model/version, annotator labels,
adjudication and partition. Any raw audio collection requires a separate approved
retention/deletion policy; current product attempts still retain no recordings.

Split **by speaker**, e.g. 24 development / 8 validation / 8 held-out test speakers;
keep duplicate prompts/conditions tracked and avoid leakage. Lock the held-out
set before tuning; report per-phone and subgroup confusion, false warnings,
missed errors, abstention coverage, timing and confidence calibration. Establish
acceptance criteria with linguistic/product owners **before** inspecting held-out
results. Do not choose arbitrary 70/80/90 acoustic thresholds. Any future mastery
mapping needs a separately approved calibration version/locale and retained
evidence; the existing 90% written rule is not changed by this plan.

### Delivery verdict

Final Phase H targeted validation: shared/API **57 PASS, 1 PostgreSQL SKIP**;
mobile **42 PASS**; Python **34 PASS**; isolated codec tests **8 PASS, 2 integration
SKIP**; actual Node → Python PCM/reference/readiness **1 PASS**. Shared build,
API build/typecheck, User typecheck and Expo Web export all pass. Export: 1,096
modules, 51 assets, bundle `entry-3d178d48ae50b145dfb2b6ec49c99da9.js`
(14.5 MB); no public runtime was changed. The latest loaded-host Node acoustic
request took **53,713 ms** (worker total 39,437 ms, CPU 5,203.125 ms), excluding
the preceding readiness probe. This is close to the 60-second deadline, not a
production performance PASS. These targeted results supersede the historical
A–G counts above; skipped tests are not counted as successful real acceptance.

**PARTIAL_PASS / BETA_DEPLOYMENT_DEFERRED.** Code can be versioned after targeted
checks; no VPS package installation, feature activation, migration, paid call,
Azure subscription or service restart has occurred. English is locally
`ACOUSTIC_UNCALIBRATED`; 33 languages are `PRACTICE_ONLY`. All 34 remain on their
existing public practice behavior. Prosody NOT_IMPLEMENTED, calibration
NOT_CALIBRATED, `masteryEligible=false`, pronunciation 90% gate DISABLED.
