# Local phonetic evidence engine V1

Private one-shot Python subprocess for **uncalibrated English acoustic evidence**.
It opens no port, makes no network/provider calls and writes no audio/text logs or
recordings. The parent API owns authentication, tenancy, request timeout,
concurrency, canonical evidence persistence and the existing progression rules.

## Honest capability

- Supported target: `en`, mapped explicitly to the shipped **en-US** acoustic model.
- Explicit `en-GB`, every other language and missing language: `NOT_EVALUABLE`.
- Canonical phones come from the shipped CMU pronunciation **lexicon**, rendered
  in broad stressless US IPA. This adapter is not a general neural G2P system.
  Out-of-vocabulary words are **not** guessed and produce `NOT_EVALUABLE`.
- Two real PocketSphinx passes align words, then phonemes/HMM states.
- A raw integer acoustic log score and its technical per-frame normalization are
  returned. They are **not** posterior probabilities, GOP, accuracy percentages,
  comparable scores across different phonemes, or intelligibility grades.
- `observed`, `bestAlternative` and confidence remain `null`: forced alignment
  places the expected reference; it does not prove which phoneme was spoken.
- A separate existing-model ASR pass compares recognized words with expected
  words by edit distance. Omissions/substitutions are **tentative ASR evidence**,
  never a pronunciation grade or an automatic claim of learner error.
- Fluency exposes alignment timings/pauses/rate, not a pedagogical score.
- Prosody is `NOT_IMPLEMENTED`. All overall/pedagogical scores stay `null`.
- Every success remains `UNCALIBRATED`, `masteryEligible=false`, capability
  `ACOUSTIC_UNCALIBRATED`. Failure is `PRACTICE_ONLY`. No 90% certification.

## Input / output

Run `python services/phonetic-engine/phonetic_engine.py` with one JSON object on
stdin and close stdin. Stdout is one IPC JSON response, **not a logging stream**.
Do not save or print this private response in infrastructure logs.

Required: `audioBase64`, `expectedText`, `language` (or `targetLanguage`). Optional:
`locale`, `learnerLevel`, `lessonId`, `exerciseId`. There is no file/URL input.
The generic `en` locale alias maps explicitly to the model's `en-US` locale;
the result always records the actual model locale.

The same private CLI accepts `{"operation":"capabilities"}` without audio. It
checks the pinned installed package and exact audited acoustic-model, lexicon and
secondary-language-model hashes. It does not initialize inference, download a
model, install dependencies or contact a provider. An unavailable/incompatible
runtime returns `available=false`, `PRACTICE_ONLY` and a fixed safe error code.
Compressed MIME formats are advertised only when an explicit absolute existing
`PHONETIC_FFMPEG_EXECUTABLE` is configured; this is readiness, not proof that every
browser codec has been tested. The API feature flag and per-language gate remain
authoritative. The fingerprint constants identify model artifacts, not secrets.

Output: `status`, language/locale/version/reference, `words`, `phonemes`, structured
error codes, technical `evidence`, nullable scores, calibration and eligibility.
`expectedArpabet` is a private model-inventory diagnostic; the parent must not
present provider/model vocabulary as learner-facing product terminology.

`evidence.model.modelArtifactSha256` identifies the exact available acoustic
files (`mdef`, `means`, `variances`, `sendump`, `transition_matrices`, `feat.params`,
`noisedict`). It is SHA256 of the sorted compact JSON manifest
`[[name,byteLength,fileSHA256],...]`. `lexiconSha256` hashes the lexicon file bytes.
These are immutable cached values per worker process; model/lexicon directories
must be read-only while a worker runs. Changing a model requires a fresh worker.
Only named regular files inside the model directory are included; symlink escapes
are rejected. The audit helper also hashes the secondary ASR language model for
reproducibility, without treating it as a pronunciation model.

Technical guards: 8 MiB maximum JSON input, 6 MiB decoded audio, 0.15–30 seconds,
80 reference words, 2,000 reference characters, 800 phonemes, 1 MiB output. These
are resource guards, not commercial quota policies. Header size/duration is
validated **before** PCM decoding and before model loading. Corrupt/truncated
audio, effectively digital silence and unrepresentable targets are rejected.

PCM WAV 8/16/24/32 bit, 1–8 channels and 8–192 kHz is decoded in memory, downmixed
and linearly resampled to signed mono16 PCM at16 kHz. This minimal resampler is
not a validated high-fidelity acoustic front end; the conversion is recorded.
No equalization, de-noising, artificial score enhancement or resampling quality
claim is made.

Non-WAV conversion requires the operator's explicit absolute
`PHONETIC_FFMPEG_EXECUTABLE`. No PATH guessing, shell, URL or automatic dependency
installation. Conversion uses stdin/stdout, pipe-only input protocols and a fixed
duration sentinel/20-second timeout. Audio longer than the guard is rejected,
never silently truncated for grading. WAV floating-point/compressed encodings are
not accepted by this first PCM decoder.

## Dependencies and operation

Python3.12, `pocketsphinx==5.0.4`; engine logic otherwise uses the standard library.
Install separately into an approved isolated environment. Do not pip-install in
the API at boot. No model download occurs in engine code: only model files shipped
with the pinned distribution are used. The parent must enforce process deadline,
bounded stderr and single-request concurrency before production activation.
The one-shot POSIX CLI enforces25 CPU seconds and512MiB address space with
`setrlimit`, preserving any stricter inherited limits; failure to apply these
limits rejects the request. A parent wall-clock deadline and process concurrency
limit are still required. Windows local execution does not enforce a process-
memory hard limit. Local peak-RSS measurements are observations, not such an
enforcement guarantee. Importing and calling the library directly is for tests;
the private API must use the bounded child CLI, not in-process native decoding.

`POSSIBLE_OMITTED_WORD` refers only to a tentative secondary-ASR word mismatch.
`POSSIBLE_PHRASE_MISMATCH` means no reference words matched the secondary ASR
result; it is uncertain lexical evidence, not an acoustic correctness diagnosis.
`EXCESSIVE_INTERNAL_PAUSE` records a measured gap over1,500ms, not an expert
judgement or CEFR failure. Learner level is retained as context, without inventing
age/level grading thresholds. Neither descriptor changes eligibility or scores.

Deterministic tests: `python -m unittest discover -s services/phonetic-engine/tests`.
Optional model integration is enabled by `PHONETIC_TEST_WAV_PATH` and
`PHONETIC_TEST_EXPECTED_TEXT`; only use an authorized technical speech recording.
Synthetic tones test guards, never pronunciation validity.

## Phase H controlled validation: abstain from unsupported diagnosis

The local controlled set uses five synthetic reference phrases, four lexical
phone/word contrasts, an omitted word ending, an unrelated phrase, a partial
phrase, an inserted two-second pause, additive noise and silence. These are
authorized offline Windows SAPI test fixtures, not learner recordings, human
pronunciation labels or calibration. The altered utterances were resynthesized;
the synthesis of the intended isolated sound was not confirmed by a human.

The actual 5.0.4 engine forced the expected phones onto altered audio. Secondary
ASR distinguished some word contrasts but also returned the expected word for
other deliberate changes, and returned `worked` for the synthetic `work` when
the reference was `works`. It did not establish a reliable missing-final-phone
or phoneme-substitution diagnosis. Raw log-likelihood changes cannot solve this
by an arbitrary threshold. Word-level tentative omissions survive failed
alignment; noise can produce misleading ASR mismatches and must remain uncertain.

Accordingly every result includes `evidence.pronunciationDiagnostic` with
`INSUFFICIENT_ACOUSTIC_CONFIDENCE`, no weak-phone/weak-word correctness claims,
no high-confidence issues and null confidence. `evidence.alignmentQuality`, when
available, means reference alignment only, never 'correctly pronounced'. Do not
label aligned words stable, good, weak or mastered from raw scores. Zero specific
warnings on clean fixtures demonstrates safe abstention, not a useful detector's
sensitivity. Targeted phone remediation and 'improvement' require validated
diagnostic evidence; they must not be claimed from these likelihoods.

`tests/run_phase_h_acceptance.py --fixtures <authorized-directory> --output
<report.json> --concurrency` executes the controlled test and isolated local
one/two/three-process measurements. It records all expected manipulations only in
the fixture manifest, separate from production inference. The report contains
preprocessing, ASR completeness, alignment, total/CPU timings, peak process memory
and raw evidence. Aggregate child peak memory is an upper bound, not an observed
simultaneous peak. These few local runs support min/median-observed/max only, not
a representative p95 or VPS load guarantee. Production concurrency remains a
separate API guard. No provider is called, and no 90% mastery rule is changed.

An additional opt-in `tests/test_browser_audio_formats.py` uses
`PHONETIC_TEST_FFMPEG_PATH` (approved absolute existing executable),
`PHONETIC_TEST_WAV_PATH` and, for one acoustic round trip,
`PHONETIC_TEST_RUN_COMPRESSED_ALIGNMENT=1` plus
`PHONETIC_TEST_EXPECTED_TEXT`. It generates WebM/Opus, Ogg/Opus and fragmented
MP4/AAC **in memory**, then exercises the existing normalizer, corrupt/short/long
inputs and timeout mapping. A synthetic container round trip does not prove a
real browser microphone, permission prompt or human recording. No extra runtime
package is installed by these tests. The separately approved local test-only
`imageio-ffmpeg` wrapper licence does not determine its FFmpeg binary's licence;
audit the actual binary build flags/notices before any redistribution. No binary
is bundled in the repository or implicitly transferred to the VPS.
The inspected local test binary identifies itself as FFmpeg7.1 Gyan essentials
and reports `--enable-gpl --enable-version3`; treat that actual build as GPLv3,
not as a BSD/LGPL-only binary. This local test does not authorize redistribution.

## Licence evidence / scientific limits

- [PocketSphinx code licence](https://github.com/cmusphinx/pocketsphinx/blob/v5.0.4/LICENSE):
  BSD-style notices and redistribution conditions must be preserved.
- [Shipped US acoustic model notice](https://github.com/cmusphinx/pocketsphinx/blob/v5.0.4/model/en-us/en-us/README):
  Alpha Cephei2015, BSD-style source/binary redistribution conditions.
- [CMUdict licence](https://github.com/cmusphinx/cmudict/blob/master/LICENSE):
  Carnegie Mellon notices and redistribution conditions.
- [Official AlignmentEntry score documentation](https://pocketsphinx.readthedocs.io/en/stable/pocketsphinx.html#pocketsphinx.AlignmentEntry):
  score is acoustic log probability, higher is better.
- [Official pronunciation-evaluation discussion](https://cmusphinx.github.io/wiki/pocketsphinx_pronunciation_evaluation/):
  raw alignment ranking alone has no demonstrated calibrated intelligibility
  mapping. Human-labelled calibration, held-out validation, accent/age coverage
  and accepted pedagogical thresholds remain separate prerequisites.

No third-party weights or licence texts are copied into this repository. Retain
the dependency's bundled notices in every runtime image/artifact that includes it.
