# Portable V2 acoustic benchmark — preparation, not product acceptance

The original Celeron N4020 machine is excluded from execution, even if its free
RAM changes. Do not retry loading Wav2Vec2 there, change its pagefile, close other
applications automatically or use the production OVH host. The package builder
and `--verify-only` use stdlib/file hashes only and are safe preparation modes.

## Intended isolated host and one command

- **Windows x64, CPython 3.12.14 with pip**. These are visible prerequisites;
  Linux/ARM are rejected, not run without the existing Windows Job protection.
- 8 GiB total RAM recommended minimum, 16 GiB preferred. At least **4 GiB
  physically available AND 4 GiB commit headroom**, no low-memory notification
  or baseline page-outs. This is an explicit conservative benchmark-host guard,
  **not a measured model minimum or production requirement**.
- CPU only, one model thread. No GPU, microphone, credentials, OpenAI/Azure/
  Google account, database, Docker, browser or SSH required.
- Approximately 1.01 GiB free scratch disk initially: the exact benchmark-only
  envelope is three times the 317720323 artifact bytes plus 128 MiB. Dependencies,
  cache and output must be outside the source tree; RAM/disk are checked.
- Internet for one pinned dependency installation and five public model files;
  cached subsequent runs verify the same hashes. No inference API is contacted.

Transfer and extract the supplied ZIP onto that host, then run from its parent:

```powershell
python .\phonetic-engine\benchmark\run_benchmark.py --output-dir D:\SB-Benchmark\run-001
```

The output directory must be new. `--cache-dir D:\SB-Benchmark\cache` is optional;
the default is the user's `.cache/second-brain-phonetic-v2`, outside source.
The single command performs package/source/data integrity checks, host/RAM/commit/
disk preflight, pinned isolated pip installation, hash-verified model download,
load-only child, one real short smoke inference, three controlled repetitions,
fresh PocketSphinx comparison and final JSON. No phase is retried after failure.
The installer has `--only-binary --no-deps --no-cache-dir --no-compile`, using the
flattened exact lock. `sounddevice` is not used or installed: input is frozen PCM
WAV files, not microphone audio. See `environment.lock.json` for every component.

For a safe transfer check only:

```powershell
python .\phonetic-engine\benchmark\run_benchmark.py --verify-only
```

This verifies all packaged files and the frozen corpus, without querying model
memory, installing dependencies, downloading or loading a model.

## Same experiment, relocated files only

The original inventory and historical baseline remain byte-identical. Their old
absolute paths are archival provenance, never instructions to create directories
on the new host. `--fixture-root` resolves only the child execution paths to the
packaged WAV files after SHA checks. Original gold, expected text, categories,
audio, five primary alterations and secondary-manipulation caveats are unchanged.

`model-manifest.json` pins the exact model/revision, five sizes/hashes, Apache-2.0
declaration, 392-token vocabulary and hashes of ten frozen acoustic components.
The mapper, CTC, GOP-like scorer, completeness, fluency and ONNX loader are not
rewritten. The supervisor has only an additive optional fixture-location input.
Its named Job, physical/commit/paging monitors and stage permissions still apply.
No smaller guard or unprotected fallback is introduced.

Model weights and installed dependencies are absent from Git and the ZIP. The
model download has no retry and refuses wrong sizes/hashes or alternate model
revisions. Interrupted partial files are preserved as failures, not silently
repaired or overwritten. Choose a new cache after investigation if needed.
Keep the model/runtime notices and the bundled CMUdict BSD-style license.

The historical baseline remains 0/5 reliable localizations. On the new host the
existing PocketSphinx worker is rerun on exactly the 15 frozen WAVs. Its main
routine is deliberately **not called**: it would regenerate three fixtures.
Fresh per-case cold-process timings/RSS/CPU are separated from historical
measurements; they are not described as warm model-session latency.

## Bounded gates, measurements and honest reporting

1. Load-only child: no inference; observe imports/session load and memory release.
2. New child: one short existing clean fixture. Require real `[1, frames, 392]`
   posteriors, CTC/phonemes and uncalibrated evidence, not just exit code zero.
3. Three successful serial repetitions of the same 15-case controlled inventory,
   at most 46 ONNX assessments including smoke. A silence/preprocessing refusal
   need not invoke the neural session. No automatic retry or phase restart.
4. Fifteen existing PocketSphinx file workers, one isolated cold child per case.
   Stop on a technical failure; intentional NOT_EVALUABLE stays an abstention,
   never a fake pronunciation error or a fabricated success.

`final-report.json` keeps the original per-case regions, raw/filtered/reliable
localizations, reference false positives, confidence (including null),
abstentions, exact five-case denominator and three repetitions separately.
Never turn 5 gold cases into 15 independent cases or count NOT_RUN as zero.
Fresh current-host side-by-side results and historical baseline are distinct.

Measure full load and child RSS/private commit/Job peaks, system available RAM,
commit and post-exit release. The report process's RSS is not model memory.
Report min/median/max and sample counts, with actual first/warm flags, never p95.
Existing `warmInferenceElapsedMs` measures session plus posterior conversion,
not native inference alone. GOP/evidence residual includes scorer overhead;
neither is misrepresented as an independently instrumented pure kernel timer.

Technical execution PASS is not acoustic acceptance. Raw negative margins and
uncalibrated candidates cannot prove observed phones or useful diagnosis. The
report retains `quality=NOT_VERIFIED` until the per-case signal and false-positive
evidence are reviewed. Do not invent an "acceptable" false-positive cutoff or
enable product integration automatically. Distinguish the eventual decisions:
useful signal; unreliable signal/model rejected; useful signal but impractical
hardware. FP32 remains optional and off; quality loss versus FP32 is NOT_MEASURED
until a real subsequent A/B evaluation is explicitly run on an adequate host.

## Build a transfer package from the committed source

Only technical authorized inputs and an explicit source whitelist are packaged.
The builder requires all included source files to be committed and unchanged;
unrelated dirty Workspace files are neither read nor packaged. Use byte-preserved
source (ZIP, or Git checkout with `core.autocrlf=false`) for frozen raw SHA checks.

```text
python services/phonetic-engine/benchmark/run_benchmark.py
  --prepare-package <new-portable.zip>
  --inventory <original-controlled-inventory.json>
  --baseline <original-controlled-after.json>
  --fixtures-dir <original-frozen-fixtures-directory>
  --dictionary <cmudict-stress.dict>
```

`CMUDICT-LICENSE.txt` must accompany the dictionary. `package-manifest.json`
records the actual committed source SHA/branch and every packaged file hash;
the delivered ZIP has a separate SHA-256. No private config, secrets, model
weights, learner files or other application modules enter the archive.

Local preparation tests require no acoustic package:

```text
python -S -m unittest discover -s services/phonetic-engine/tests -p test_portable_v2_*.py
```

No paid calls, migration, server operation, beta deployment or product integration
is authorized by this package. Calibration stays NOT_CALIBRATED, mastery ineligible
and the pronunciation 90% gate disabled. A different benchmark host is still
required; preparing/verifying this ZIP is not a real inference result.
