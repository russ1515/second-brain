# Local ONNX INT8 experiment — not a product capability

This is a separate posterior source for the existing V2 mapper, expected-sequence
CTC and uncalibrated GOP-like evidence. It neither edits nor weakens the FP32
runtime's 3 GiB guard. There is no API/UI/Passport/mastery integration, no VPS
operation and no paid provider. `masteryEligible` remains false. Raw posterior
alternatives are not reliable observed phonemes or pronunciation grades.

## Pinned artifacts and provenance

The [ONNX publisher's card](https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/blob/c69750f5043e5e1f8a71ab95dd3b98338c280c92/README.md)
declares Apache-2.0, identifies the Facebook base checkpoint and links its
automatic ONNX conversion. Derived revision:
`c69750f5043e5e1f8a71ab95dd3b98338c280c92`. The exact exporter commit and source
revision used for conversion are not recorded by the publisher. Documentary
provenance is sufficient for this isolated experiment, not proof of an
independently reproduced conversion or numerical equivalence to FP32.

Only these five artifacts are allowed; download from the pinned revision into a
local directory outside Git. The ONNX artifact is `onnx/model_int8.onnx` upstream
and is stored as `model_int8.onnx` in that directory. No alternate or FP32 weight,
training file, remote Python code or online phonemizer is required.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| model_int8.onnx | 317712780 | 74174710e34035bbb7f611601d016c32fc575de7a6f53b1078107dc10a84e7ae |
| config.json | 2382 | 428b7781d080ad9463dca0e17e5066073cb691bfc14a178a85e76ac79c1f4a0f |
| preprocessor_config.json | 212 | a2254a5b58f72cd4de3632f8eee64f3f098b7c1402128d2f419e7d00ae13e335 |
| vocab.json | 4637 | d732ab2456c0c017930001dc9af0b41b3b93d25b2eb9740bf9d925508d7d87d0 |
| quantize_config.json | 312 | 70f61db8708568fa3ee6e66ecbcfdb8a89b9069feadff679dea00b097e521c98 |

Total artifact download: **317720323 bytes**. Vocab is byte-identical to the
audited Facebook revision `ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4`:
392 tokens, blank/PAD 0. Existing CMU39 mappings, reverse alternatives and stress
semantics are retained. The pinned CMUdict file/hash in the FP32 README is reused.

`quantize_config.json` declares `per_channel=false`, `reduce_range=false`,
`is_symmetric=true`, `quant_type=1`. The integer is not interpreted without the
publisher's exact converter enum/version. Actual accuracy must be measured.

Use the separate `onnx-requirements.txt`, not FP32 requirements: ONNX Runtime
1.23.2 CPU (MIT), NumPy 2.2.6 and the recorded permissive dependencies. Retain
their notices, including native NumPy notices; the entire binary stack is not
Apache-2.0. CPython 3.12 Windows amd64 ORT wheel reference SHA-256:
`25de5214923ce941a3523739d34a520aac30f21e631de53bba9174dc9c004435`.
No Torch/Transformers/phonemizer dependency is introduced by this path.

## Safety protocol and phase boundaries

The runtime requires an external safety callback; a caller-supplied boolean is
not, by itself, a safe execution environment. Use the Windows supervisor and
stdlib-only child bootstrap. No heavy native import precedes attachment to a
verified named Job. The Job enforces a per-process and job-wide commit cap,
one active process and kill-on-close. The parent monitors system physical and
commit headroom, low-memory notification, paging and child/job memory peaks.
Monitoring failure or pressure stops this test only, never unrelated processes.
No working-set trimming, pagefile changes or security-setting workaround.

The pre-load envelope limits total child commit to
`min(minPhysicalAvailable / 2 - physicalJitter,
minCommitHeadroom / 2 - commitJitter)`, using the actual baseline extrema.
The protected system reserves are the observed minima minus this child budget.
A non-positive budget or baseline paging/low-memory signal stops before load.
This relative, conservative confinement is **not** a
measured ONNX minimum, an arbitrary replacement RAM guard or a production rule.
A failed/aborted load gives only a lower bound/truncated peak; do not infer full
model RAM from that, the file's 318 MB size or the Python harness's memory.

Run in this order, using exclusive output directories and saving each result
before interpretation:

1. `load`: import CPU ORT, initialize vocabulary/preprocessing, load session,
   record RAM/timing, exit. **Zero inference.** Verify process gone and Job empty.
2. Only after a successful load/release gate: new `tiny` child, at most one short
   inference. Verify tensor shape, output evidence, CPU/RAM and child release.
3. Only after a successful tiny gate: new `benchmark` child, same frozen 15 Phase
   H fixtures and five gold alteration regions, serially, with no retry.

CPUExecutionProvider only; one intra/inter thread, sequential execution, no CPU
arena/memory pattern, graph optimization disabled and prepacking disabled.
These choices prioritize bounded load over presumed speed. The N4020's SSE4.2
support and ORT's conditional CPU dispatch are documentary compatibility, not
proof that every graph kernel has executed on this machine.

An attempt that fails at any gate ends this evaluation. Do not run audio to
work around an insufficient load envelope, disable Windows pressure checks,
close Chrome automatically, retry until lucky or move the experiment to OVH.

## Scientific reporting

Reuse `comparison_report` and immutable audio/inventory/baseline hashes. Record
raw candidates and clean-reference false positives separately from filtered
candidates, abstentions and reliable localizations. Five alteration cases stay
the same denominator; `NOT_RUN` is not a new 0/5 acoustic result. Completeness
carried from the historical baseline must be clearly labeled and matched by
exact audio/text, never inferred from a fixture's gold label.

FP32 has never loaded/inferred on this machine. Therefore INT8 quality loss
against FP32 is **NOT_MEASURED**, regardless of historical PocketSphinx results.
No calibrated intelligibility, prosody, observed phoneme or mastery claim.
Report min/median/max only for actual samples, first versus warm inference
separately, and no p95 from these few synthetic fixtures.

## 2026-10-21 measured checkpoint — load interrupted, no inference

Local installation and five artifact hashes passed. **36/36 new targeted tests
passed**: 14 fake-session adapter tests and 22 safety/protocol/Windows tests.
The Windows tests actually denied a 12 MiB stdlib allocation under a 10 MiB Job,
checked exact membership and kill-on-close, and queried native PDH/low-memory
state. That small Job is a unit-test fixture, not a new ONNX RAM guard. Existing
52 deterministic V2 tests and the byte-identical vocab evidence are reused;
they do not become real neural acoustic acceptance.

One real `load` attempt, zero inferences, was run with CPython 3.12, isolated ORT
1.23.2 CPU, one thread, `--baseline-samples 8 --timeout-sec 180`. The native
dependency import completed and session construction was authorized. Before
session construction returned, the independent parent stopped the child with
`COMMIT_RESERVE_REACHED`. No model-ready event occurred. `modelLoad=NOT_RUN` in
the raw proof denotes no completed load; this is an attempted/interrupted load,
**not** a model successfully occupying just the measured peak.

| Observation | Actual measurement |
| --- | ---: |
| System available physical RAM, baseline minimum | 684630016 bytes (652.91 MiB) |
| System available physical RAM, baseline maximum | 686694400 bytes (654.88 MiB) |
| Temporary child total-commit limit | 340250624 bytes (324.49 MiB) |
| Child peak resident working set | 347209728 bytes (331.13 MiB) |
| Child peak private commit | 335245312 bytes (319.71 MiB) |
| Job-reported peak commit | 341823488 bytes (325.99 MiB) |
| System available physical RAM at STOP | 463990784 bytes (442.50 MiB) |
| System available physical RAM after child exit | 805167104 bytes (767.87 MiB) |
| Time from session-load authorization to STOP | 6.36 s, **incomplete load** |
| Observed page-out rate / OS low-memory flags | 0 / false throughout |
| Remaining child processes / monitor failures | 0 / 0 |

The OS-confirmed child exit and empty Job prove release of this test's memory.
Other applications, file cache and commit can vary; the difference in free
system RAM is not an exact model allocation. The peak was truncated by safety
termination. No full model footprint, safe model requirement, completed load
time, inference latency, phoneme quality, false-positive rate or abstention rate
has been measured. No second attempt, tiny inference or benchmark was run.
The historical PocketSphinx result remains 0/5; ONNX is **NOT_RUN**, not 0/5.

Local evidence, outside the Git worktree:

- `deliverables/phonetic-onnx-int8-20261021/model-artifacts.json`
- `deliverables/phonetic-onnx-int8-20261021/load-only-01/result.json`, SHA-256
  `bb79b23aa38b3bf0cb9fdfbd77ba72fe3db2ad88e59a9d961251e703fd89d078`
- `deliverables/phonetic-onnx-int8-20261021/load-only-01/stages.jsonl`, SHA-256
  `80a09f782cd2f10c72c3510cfbf6cfe791ddb1367e56d4602d72f8259b2e095c`

The result fingerprints the executable, machine (hostname hash only), runtime
source, artifacts, dictionary and dependency entry points before interpretation.
The two unrelated dirty Workspace files remain byte-identical and unstaged.
FP32 code/guard, product capability and live beta are unchanged. Cost $0,
zero migrations, zero VPS operations, zero push/deploy.

### Reproducible continuation, not an automatic retry

On another local machine with more safely available headroom, reuse the exact
artifacts, frozen fixtures and baseline; do not re-download the FP32 weights.
First repeat only `load` into a **new** output directory:

```text
python -S services/phonetic-engine/v2/onnx_smoke_supervisor.py
  --phase load --model-dir <verified-model-directory>
  --dictionary <verified-cmudict-stress.dict> --deps-dir <isolated-python-deps>
  --metadata-hashes <audited-metadata-hashes.json> --provenance-verified
  --output-dir <new-exclusive-directory> --baseline-samples 8 --timeout-sec 180
```

The metadata JSON maps `config.json`, `preprocessor_config.json` and
`quantize_config.json` to the exact table hashes above. Install only the separate
requirements with `--only-binary=:all: --no-cache-dir --no-compile --target`.
Keep Windows CPU/architecture compatibility; do not bypass Job/PDH failure.

Do not derive a new fixed experimental minimum from this failed run. A future
successful load, then separately bounded inference, must supply the true peak
before adding an explicit safety margin for that hardware/audio scope. Until
then, the actual ONNX memory requirement and INT8 quality remain unknown. The
3 GiB FP32 guard is unchanged and is not repurposed as an INT8 measurement.
