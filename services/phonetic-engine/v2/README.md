# V2 local phoneme-posterior research layer

These modules do not replace or enable V1 in the API. No weights are bundled or
downloaded, no provider is contacted, and no UI, Passport, registry, lesson or
mastery behavior is changed. English/en-US only. Calibration remains absent,
`masteryEligible=false`, all pedagogical scores/confidence and observed-phone
claims remain null. Real acoustic acceptance is separate from posterior tests.

## Interfaces

```python
mapper = CanonicalPhonemeMapper(verified_vocabulary_dict)
words = expected_words_with_stress(text, verified_cmu_dictionary_path)
expected = mapper.map_words(words)
result = Wav2Vec2PhonemeScorer(mapper).score(
    normalized_log_posteriors_as_lists, expected,
    frameStrideMs=model_output_stride_ms,
    contentStatus="UNKNOWN",
)
```

`contentStatus` is `UNKNOWN`, `MATCHED`, `MISMATCH` or `PARTIAL`, supplied only by
the existing independent content/completeness layer. It must not be inferred
from the known test-fixture category, and `MATCHED` never certifies phonetics.
The caller owns licensed local model loading, weight/vocabulary integrity,
waveform preprocessing, inference resources and exact output-frame stride.

### Mapping

`mapper.py` retains all 39 CMU phoneme IDs (`cmu:AA`, etc.) and original stress.
The verified model inventory is explicitly linked through IPA symbols, never
ARPABET string comparison. AH0→ə and ER0→ɚ differ from AH1/2→ʌ and ER1/2→ɜː.
Missing stress on these ambiguous phones, unknown phones, missing vocabulary
symbols or unsupported locales fail explicitly; nothing is silently dropped.
Affricates and diphthongs use actual single vocabulary tokens, not character
splitting. Unknown competing model symbols remain raw evidence, not fabricated
canonical alternatives. Canonical IDs are independent of model numeric IDs.

The supplemental stress lookup reuses V1 G2P tokenization/OOV/lexicon behavior,
then keeps raw stress only for requested entries from the same caller-supplied
immutable lexicon. V1 is not edited. Only its first canonical pronunciation is
currently assessed; accepted variant pronunciations and accents remain a real
scientific limitation, not learner mistakes.

### Expected-sequence CTC

`CTCExpectedAligner` uses a blank-interleaved 2N+1 trellis, Viterbi alignment and a
log-space forward recurrence. Repeated adjacent labels require an intervening
blank. The expected sequence remains authoritative; greedy decoded phones do not
determine alignment. Input shape, normalized log-probabilities, finite numeric
values and technical memory/DP bounds are checked.

The reported `bestPathConditionalPosterior` is the best allowed path's posterior
conditional on the expected sequence, **not** pronunciation confidence or human
alignment accuracy. Boundaries are model-output frame intervals, not validated
manual phonetic timestamps. Forced paths can exist for wrong/noisy audio.

Reference topology: [Graves et al., 2006, §4.1](https://www.cs.toronto.edu/~graves/icml_2006.pdf).
Tests compare both likelihood recurrences with exhaustive small CTC-path sums.

### Raw contrast, not a 0–100 grade

For an expected phone's aligned emission frames:

- `rawScore` = mean log posterior of its expected model token;
- `marginToAlternative` / `gopLikeScore` = that mean minus the best competing
  nonblank phoneme token's mean log posterior;
- `relativeMargin` = difference of arithmetic posterior means for those tokens;
- posterior candidates, normalized entropy and blank evidence are retained for
  audit, with no conversion to calibrated confidence.

This is a simple GOP-like posterior contrast, not a claim of calibrated GOP or
intelligibility measurement. A negative margin creates a tentative research
region only; zero is a ranking boundary, not a chosen pedagogical threshold.
The implementation does not contain reference test words or a fitted acceptance
cutoff. Ties, blank-dominant regions, unmapped competing phonemes, variants of the
same canonical phone, unsupported compound comparisons and independent content
mismatch/incompleteness produce explicit abstention. Literal zero competitor
mass never creates Infinity/NaN in the JSON evidence contract.

`rawWeakRegionCandidate` remains visible even when a safer diagnostic abstains.
Controlled-reference false positives must count these raw candidates separately;
do not hide bad signal behind the always-null observed/confidence fields.
`observedPhoneme=null`, `confirmedPronunciationWeakness=false` and an empty
confirmed-weakness list prevent a raw alternative from masquerading as what the
learner actually pronounced. Noise, accent/allophone mismatch and valid lexical
variants still require controlled and human validation before any product use.

## Tests

Run `python -m unittest discover -s services/phonetic-engine/tests -p 'test_v2_*.py'`.
Set `PHONETIC_V2_VOCAB_PATH` only to the already verified public 392-token model
vocabulary for its optional exact SHA/ID test. The other tests use synthetic
posteriors and a tiny independent lexicon/vocabulary, requiring no native model,
package installation, microphone, network or provider. They establish algorithm
and safety behavior, **not** acoustic diagnostic quality or real-word accuracy.

## Immutable artifacts and licenses checked before download

The [official model card](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft/blob/ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4/README.md)
declares Apache-2.0, as does its parent checkpoint. The audited revision is
`ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4`. It lists one official weight artifact,
`pytorch_model.bin`, **1,263,535,127 bytes**, SHA-256
`3173bde9e9ce490fa0f989e413c42f25bc1820c020adc1e6b9b87025b3cfcc5e`.
There is no official safetensors file in that revision. This local runtime checks
the weight/config/vocabulary hashes, uses `weights_only=True`,
`local_files_only=True`, `trust_remote_code=False`, and never falls back to unsafe
pickle loading, a network download or remote Python code. No weights enter Git.

The [CMUdict source](https://github.com/cmusphinx/cmudict/tree/74790861f652b15e4ac49015a90074ad62a27690)
is the same lexicon family used by G2P, with original stress preserved under its
permissive BSD-style notice. Local stressed dictionary: 3,618,488 bytes, SHA-256
`81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22`.
The V1 tokenization/OOV behavior is reused; no second phonemizer is introduced.

The locally installed research stack is CPU-only Torch 2.8.0+cpu (BSD-3-Clause),
Transformers 4.57.6, tokenizers 0.22.1, safetensors 0.6.2 and huggingface_hub 0.36.0
(Apache-2.0), NumPy 2.2.6 and psutil 7.1.0 (BSD-3-Clause). The vocabulary JSON is
read directly; the eSpeak-backed tokenizer is **not instantiated**. Do not
install Transformers `audio`/`speech`/`all` extras, phonemizer or eSpeak as an
unreviewed convenience: those optional phonemizers carry GPL-3.0 obligations.

No license conflict was identified for this local evaluation. This is not legal
certification or approval to redistribute the binary stack. Preserve model/CMU
notices and native Torch/NumPy third-party notices. Transitives include certifi
and tqdm MPL-2.0 obligations and regex's additional CNRI-Python terms; do not label
the entire stack Apache or MIT. The generated local resource/dependency audit
records 26 actual package versions and SHA-256 references to notice files.
Any future production distribution still requires review of those exact binary
notices. MFA and Allosaurus are not installed or required by this experiment.

## 2026-10-21 execution checkpoint — blocked before native model loading

The frozen Phase H inventory retains 15 exact audio hashes and five alteration
regions, independent of V2 output. The historical baseline remains **0/5 reliably
localized**; it was not re-inferred or rewritten. The acceptance runner keeps raw
candidate localization, filtered candidates and confirmed diagnosis separate.
Unrelated candidate warnings on clean references count as false-positive
observations even when calibrated confidence is null. No reported denominator
may treat `NOT_RUN` as an evaluated failure or success.

**52/52 deterministic tests PASS**, including the actual audited 392-token
vocabulary, CMU39/stress mappings, exhaustive CTC recurrence checks, alternative
competition/abstention, fixture immutability, report accounting and runtime guards.
These results do not prove the real acoustic model's accuracy or compatibility.
The full native loader/inference path has not executed.

Artifacts were downloaded only to the local `deliverables/phonetic-v2-20261021`
directory outside the Git worktree. Actual model directory: **1,263,545,273 bytes**;
isolated Python dependencies: **3,300,004,690 bytes**, 18,062 files. Approximately
97.1 GB disk free remained at measurement. Downloaded weights passed their exact
byte length and SHA-256. No production/VPS download or installation occurred.

Local hardware: Intel Celeron N4020, two CPU cores, Intel UHD 600 (no usable Torch
GPU validated), **5,931,712 KiB physical RAM**. At the single attempted acceptance,
only **540,053,504 bytes** of physical memory were available. The local runtime
therefore stopped with `LOCAL_RESOURCE_MEMORY_INSUFFICIENT` **before importing
Torch or loading weights**. Its conservative 3 GiB headroom guard is an engineering
safety policy, not measured model RSS, a commercial quota, a calibrated threshold
or a guarantee that 3 GiB is enough for every audio length.

The acceptance result was persisted before interpretation in
`deliverables/phonetic-v2-20261021/real-acceptance.json`; it has zero inferred
cases and all five controlled alterations `NOT_RUN`. The process peak reported
there (26,406,912 bytes) is only the unloaded Python harness, **not model memory**.
Model load time, actual model RAM, warm inference, alignment latency, false
positives, abstentions and scientific improvement remain **NOT_VERIFIED**.
Do not report a new 0/5 result: no V2 case was actually assessed.

Eight additional contrast fixtures (live/leave, three/tree, very/berry,
world/word) are planned outside the headline five. Their offline SAPI generation
was blocked by the environment's voice-selection security setting. No recording
was fabricated and no ACL, voice installation or security setting was changed.
This supplementary coverage is `NOT_RUN`, not a calibration dataset.

## Exact continuation boundary

1. Obtain a local research environment with sufficient available RAM. The user
   was asked to free memory; no unrelated process was stopped. Do not move this
   experiment to the live VPS to bypass the local resource block.
2. Reuse the pinned weights, dependency receipt and frozen audio inventory. No
   re-download, baseline reset, prompt/gold hint or automatic retry is needed.
3. Run `tests/run_v2_acceptance.py` with the existing baseline/fixture/inventory
   paths, the verified local model/dictionary and a **new exclusive output path**.
   The prior blocked evidence must remain intact. Model loads once, then serial
   recordings are evaluated; per-case artifacts are saved before aggregate output.
4. Inspect exact correct/total candidate and reliable localizations, raw/filtered
   false positives, abstentions and content-mismatch behavior. Do not declare
   usefulness from the aggregate log score, synthetic tests or a cherry-picked
   margin. First inference is distinguished from warm samples; no p95 is claimed.
5. Measure actual load/RAM/CPU/latency before deciding whether ONNX, quantization,
   a smaller compatible model or dedicated inference even needs investigation.
   No such optimization or deployment has been selected prematurely.

Current verdict: **PARTIAL_PASS / BLOCKED_LOCAL_MEMORY**. Diagnostic quality is
**NOT_VERIFIED**, not improved by assumption. OVH safety is NOT_TESTED; dedicated
inference is NOT_YET_KNOWN. No microphone, Passport, UI, API, Language Core,
registry, database, subscription or Workspace behavior is changed. No migration,
paid API call or beta deployment. Prosody NOT_IMPLEMENTED; calibration
NOT_CALIBRATED; mastery ineligible; pronunciation 90% gate DISABLED. English
remains a local `ACOUSTIC_UNCALIBRATED` capability, the other 33 practice-only;
the existing public beta is untouched.
