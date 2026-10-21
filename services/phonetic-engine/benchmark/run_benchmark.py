"""Portable, offline-after-preparation CPU experiment. No product integration.

Packaging/verification never imports a native acoustic runtime. Only the run
mode on an explicitly eligible OTHER Windows x64 host may start bounded model
children. No retries, remote shell, provider API, deletion or FP32 loading.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile


HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent
DATA = HERE / "data"
FROZEN_INVENTORY_SHA = "674a1b7b4aae7561898e798bacab91895467bcc3d9b5307a16faa03934918474"
FROZEN_BASELINE_SHA = "7b1b1ca417d62c1aa6d1fb4353b8bb8a10cc79e63c972c61a433c52a15633937"
DICTIONARY_SHA = "81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22"
SOURCE_PREFIX = "services/phonetic-engine/"
MIN_HOST_RAM = 4 * 1024**3  # User-authorized benchmark guard, NOT production.


class BenchmarkStop(RuntimeError):
    pass


class PhaseFailure(BenchmarkStop):
    def __init__(self, phase, proof, output_dir=None):
        super().__init__("BENCHMARK_PHASE_" + phase.upper() + "_FAILED")
        self.proof = proof
        self.output_dir = Path(output_dir) if output_dir is not None else None


def sha(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(65536), b""):
            result.update(block)
    return result.hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save(path, value):
    with Path(path).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def require(condition, code):
    if not condition:
        raise BenchmarkStop(code)


def stable_error(failure):
    value = str(failure)
    return value if value.isascii() and value.replace("_", "").isalnum() and value.upper() == value else "BENCHMARK_EXECUTION_FAILED"


def measured_comparison(directory, baseline):
    """Read only already-durable observations, including a partial failed run."""
    sys.path.insert(0, str(ENGINE / "tests"))
    from run_v2_acceptance import comparison_report
    measurements = [read(path) for number in range(1, 16)
                    if (path := Path(directory) / ("case-" + str(number) + ".json")).is_file()]
    return comparison_report(read(DATA / "inventory.json"), baseline, measurements)


def frozen_data(inventory_path, baseline_path, fixture_root, dictionary):
    """Keep original JSON bytes/gold; only resolve audio locations separately."""
    require(sha(inventory_path) == FROZEN_INVENTORY_SHA, "FROZEN_INVENTORY_HASH_MISMATCH")
    require(sha(baseline_path) == FROZEN_BASELINE_SHA, "FROZEN_BASELINE_HASH_MISMATCH")
    require(sha(dictionary) == DICTIONARY_SHA, "FROZEN_DICTIONARY_HASH_MISMATCH")
    inventory, baseline = read(inventory_path), read(baseline_path)
    require(len(inventory["cases"]) == inventory["caseCount"] == 15, "FROZEN_CASE_COUNT_MISMATCH")
    require(inventory["controlledAlterationCount"] == 5, "FROZEN_GOLD_COUNT_MISMATCH")
    require(inventory["baselineSha256"] == sha(baseline_path), "FROZEN_BASELINE_HASH_MISMATCH")
    old = {row["id"]: row for row in baseline["cases"]}
    paths = {}
    for case in inventory["cases"]:
        case_id = case["id"]
        require(isinstance(case_id, str) and Path(case_id).name == case_id and case_id not in paths,
                "FROZEN_CASE_ID_INVALID")
        path = Path(fixture_root).resolve() / (case_id + ".wav")
        require(path.is_file() and not path.is_symlink(), "FROZEN_FIXTURE_UNAVAILABLE")
        require(sha(path) == case["fixtureSha256"] == old[case_id]["fixtureSha256"], "FROZEN_FIXTURE_HASH_MISMATCH")
        require(case["expectedText"] == old[case_id]["expectedText"], "FROZEN_EXPECTED_TEXT_MISMATCH")
        paths[case_id] = path
    return inventory, baseline, paths


def core_hashes_verified(model_manifest):
    for name, expected in model_manifest["frozenComponents"].items():
        require(name.startswith(SOURCE_PREFIX), "FROZEN_SOURCE_PATH_INVALID")
        relative = PurePosixPath(name[len(SOURCE_PREFIX):])
        require(not relative.is_absolute() and ".." not in relative.parts, "FROZEN_SOURCE_PATH_INVALID")
        require(sha(ENGINE.joinpath(*relative.parts)) == expected, "FROZEN_ACOUSTIC_COMPONENT_CHANGED")


def source_files():
    # Explicit whitelist: never sweep a checkout, private config, cache or audio
    # outside the technical frozen corpus. Weights/dependencies stay outside Git.
    names = ["phonetic_engine.py", "README.md", "requirements.txt",
             "tests/run_phase_h_acceptance.py", "tests/run_v2_acceptance.py", "tests/run_local_acceptance.py"]
    names += ["v2/" + name for name in (
        "__init__.py", "errors.py", "mapper.py", "ctc_alignment.py", "scorer.py",
        "runtime.py", "onnx_runtime.py", "onnx_smoke_supervisor.py", "onnx_child.py",
        "ONNX-INT8.md", "onnx-requirements.txt", "README.md", "requirements.txt")]
    names += ["benchmark/" + name for name in (
        "run_benchmark.py", "portable_baseline.py", "portable_report.py", "README.md",
        "model-manifest.json", "environment.lock.json", "requirements-windows-x64.lock.txt")]
    names += ["tests/" + name for name in (
        "test_v2_acceptance.py", "test_v2_ctc.py", "test_v2_mapper.py", "test_v2_scorer.py",
        "test_v2_runtime.py", "test_v2_onnx_runtime.py", "test_v2_onnx_supervisor.py",
        "test_portable_v2_baseline.py", "test_portable_v2_report.py", "test_portable_v2_benchmark.py")]
    return {name: ENGINE / name for name in names}


def prepare_package(args):
    inventory, _, paths = frozen_data(args.inventory, args.baseline, args.fixtures_dir, args.dictionary)
    model = read(HERE / "model-manifest.json")
    core_hashes_verified(model)
    files = source_files()
    tracked = [":(top)" + SOURCE_PREFIX + name for name in files]
    require(subprocess.run(["git", "ls-files", "--error-unmatch", "--", *tracked], cwd=ENGINE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0, "PACKAGE_SOURCE_NOT_COMMITTED")
    require(subprocess.run(["git", "diff", "--quiet", "HEAD", "--", *tracked], cwd=ENGINE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE).returncode == 0, "PACKAGE_SOURCE_HAS_UNCOMMITTED_CHANGES")
    files.update({"benchmark/data/inventory.json": Path(args.inventory),
                  "benchmark/data/baseline-original.json": Path(args.baseline),
                  "benchmark/data/cmudict-stress.dict": Path(args.dictionary)})
    files.update({"benchmark/data/fixtures/" + path.name: path for path in paths.values()})
    # Retain the dictionary's license, never bundle an unlicensed lexical asset.
    license_file = Path(args.dictionary).with_name("CMUDICT-LICENSE.txt")
    require(license_file.is_file(), "CMUDICT_LICENSE_REQUIRED")
    files["benchmark/data/CMUDICT-LICENSE.txt"] = license_file
    for name, path in files.items():
        require(path.is_file() and not path.is_symlink(), "PACKAGE_SOURCE_MISSING")
        require(not name.endswith((".onnx", ".bin", ".dll", ".pyd")), "PACKAGE_BINARY_FORBIDDEN")
    source_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ENGINE, text=True).strip()
    manifest = {"schemaVersion": 1, "sourceSha": source_sha,
        "sourceBranch": subprocess.check_output(["git", "branch", "--show-current"], cwd=ENGINE, text=True).strip(),
        "modelWeightsIncluded": False, "dependenciesIncluded": False, "paidCalls": 0,
        "frozenInventorySha256": FROZEN_INVENTORY_SHA, "caseCount": inventory["caseCount"],
        "files": {name: {"bytes": path.stat().st_size, "sha256": sha(path)} for name, path in sorted(files.items())}}
    archive = Path(args.prepare_package).resolve()
    require(not archive.exists(), "PACKAGE_OUTPUT_ALREADY_EXISTS")
    archive.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as output:
        for name, path in sorted(files.items()):
            output.write(path, "phonetic-engine/" + name)
        output.writestr("phonetic-engine/benchmark/package-manifest.json", json.dumps(manifest, indent=2) + "\n")
    return {"status": "PREPARED_NOT_EXECUTED", "path": str(archive), "bytes": archive.stat().st_size,
            "sha256": sha(archive), "sourceSha": source_sha, "fileCount": len(files) + 1,
            "modelLoads": 0, "inferences": 0, "paidCalls": 0, "vpsOperations": 0}


def verify_package():
    manifest = read(HERE / "package-manifest.json")
    require(manifest.get("schemaVersion") == 1 and manifest.get("modelWeightsIncluded") is False,
            "PACKAGE_MANIFEST_INVALID")
    require(isinstance(manifest.get("sourceSha"), str) and len(manifest["sourceSha"]) == 40,
            "PACKAGE_SOURCE_SHA_INVALID")
    for name, expected in manifest["files"].items():
        relative = PurePosixPath(name)
        require(not relative.is_absolute() and ".." not in relative.parts, "PACKAGE_PATH_INVALID")
        path = ENGINE.joinpath(*relative.parts)
        require(path.is_file() and not path.is_symlink(), "PACKAGE_FILE_MISSING")
        require(path.stat().st_size == expected["bytes"] and sha(path) == expected["sha256"], "PACKAGE_HASH_MISMATCH")
    core_hashes_verified(read(HERE / "model-manifest.json"))
    frozen_data(DATA / "inventory.json", DATA / "baseline-original.json", DATA / "fixtures", DATA / "cmudict-stress.dict")
    return manifest


def validate_host(lock, hardware, *, node_hash, python_version, system, architecture):
    guard = lock["benchmarkHostGuard"]
    require(node_hash != guard["prohibitedNodeSha256"], "CURRENT_PC_BENCHMARK_PROHIBITED")
    require(system == "Windows" and architecture.lower() in ("amd64", "x86_64"), "BENCHMARK_HOST_PLATFORM_UNSUPPORTED")
    require(python_version == lock["python"]["version"], "BENCHMARK_PYTHON_VERSION_MISMATCH")
    require(guard["minAvailablePhysicalBytes"] == MIN_HOST_RAM, "BENCHMARK_GUARD_CHANGED")
    require(hardware["availablePhysicalBytes"] >= MIN_HOST_RAM and hardware["commitHeadroomBytes"] >= MIN_HOST_RAM
            and not hardware["lowMemory"], "BENCHMARK_HOST_MEMORY_INSUFFICIENT")
    require(hardware["pagesOutputPerSecond"] == 0, "BENCHMARK_HOST_PAGING_PRESSURE")


def hardware_snapshot():
    sys.path.insert(0, str(ENGINE / "v2"))
    from onnx_smoke_supervisor import WindowsAPI, WindowsMemoryMonitor
    monitor = WindowsMemoryMonitor(WindowsAPI())
    try:
        time.sleep(1)
        return monitor.sample()
    finally:
        monitor.close()


def normalized_name(name):
    return name.lower().replace("_", "-").replace(".", "-")


def dependencies_match(deps_dir, lock):
    expected = {normalized_name(item["name"]): item["version"] for item in lock["distributions"]}
    actual = {normalized_name(item.metadata["Name"]): item.version
              for item in importlib.metadata.distributions(path=[str(deps_dir)])}
    return actual == expected


def prepare_dependencies(deps_dir, lock):
    if deps_dir.exists():
        require(dependencies_match(deps_dir, lock), "DEPENDENCY_CACHE_MISMATCH_NO_AUTOMATIC_REPAIR")
        return "VERIFIED_CACHE"
    deps_dir.mkdir(parents=True)
    command = [sys.executable, "-m", "pip", "--isolated", "--disable-pip-version-check", "install",
        "--index-url", "https://pypi.org/simple", "--only-binary=:all:", "--no-cache-dir", "--no-compile", "--no-deps",
        "--target", str(deps_dir), "-r", str(HERE / "requirements-windows-x64.lock.txt")]
    # One explicit dependency installation, not a provider call. Never record
    # arbitrary installer output, inherited private env or authenticated URLs.
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=900)
    require(result.returncode == 0, "DEPENDENCY_INSTALL_FAILED")
    require(dependencies_match(deps_dir, lock), "DEPENDENCY_INSTALL_VALIDATION_FAILED")
    return "INSTALLED_AND_VERIFIED"


def fetch_verified_model(directory, manifest, opener=urllib.request.urlopen):
    directory.mkdir(parents=True, exist_ok=True)
    receipts = []
    for item in manifest["artifacts"]:
        name = item["path"]
        require(PurePosixPath(name).name == name, "MODEL_CACHE_PATH_INVALID")
        path = directory / name
        require(not path.is_symlink(), "MODEL_CACHE_SYMLINK_FORBIDDEN")
        if path.exists():
            require(path.stat().st_size == item["bytes"] and sha(path) == item["sha256"], "MODEL_CACHE_HASH_MISMATCH")
            receipts.append({"file": name, "sha256": item["sha256"], "bytes": item["bytes"], "downloaded": False})
            continue
        require(item["url"].startswith("https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/resolve/"
            "c69750f5043e5e1f8a71ab95dd3b98338c280c92/"), "MODEL_SOURCE_NOT_PINNED")
        partial = path.with_name(path.name + ".part")
        require(not partial.exists(), "MODEL_PARTIAL_DOWNLOAD_PRESENT_NO_RETRY")
        received = 0
        digest = hashlib.sha256()
        # No authorization header, no exception body/redirect URL in the report.
        with opener(item["url"], timeout=120) as response, partial.open("xb") as stream:
            require(response.geturl().startswith("https://"), "MODEL_DOWNLOAD_TRANSPORT_INVALID")
            while True:
                block = response.read(min(65536, item["bytes"] - received + 1))
                if not block:
                    break
                received += len(block)
                require(received <= item["bytes"], "MODEL_DOWNLOAD_EXCEEDS_PINNED_SIZE")
                digest.update(block)
                stream.write(block)
            stream.flush()
            os.fsync(stream.fileno())
        require(received == item["bytes"] and digest.hexdigest() == item["sha256"], "MODEL_DOWNLOAD_HASH_MISMATCH")
        require(not path.exists(), "MODEL_CACHE_RACE")
        partial.rename(path)
        receipts.append({"file": name, "sha256": item["sha256"], "bytes": received, "downloaded": True})
    return receipts


def run_phase(phase, output, model, deps, metadata_path, *, prior=None):
    # Outer orchestrator never imports an acoustic runtime. Existing supervisor
    # still owns all stage permissions, Job limits, native load and release.
    lock = read(HERE / "environment.lock.json")
    validate_host(lock, hardware_snapshot(), node_hash=hashlib.sha256(platform.node().encode()).hexdigest(),
                  python_version=platform.python_version(), system=platform.system(), architecture=platform.machine())
    command = [sys.executable, "-S", str(ENGINE / "v2" / "onnx_smoke_supervisor.py"), "--phase", phase,
        "--model-dir", str(model), "--dictionary", str(DATA / "cmudict-stress.dict"), "--deps-dir", str(deps),
        "--output-dir", str(output), "--metadata-hashes", str(metadata_path), "--provenance-verified",
        "--baseline-samples", "8", "--timeout-sec", "900"]
    if prior:
        command += ["--prior-gate", str(prior)]
    if phase != "load":
        command += ["--inventory", str(DATA / "inventory.json"), "--baseline", str(DATA / "baseline-original.json"),
                    "--fixture-root", str(DATA / "fixtures")]
    environment = dict(os.environ)
    environment.update({"PYTHONPATH": "", "PYTHONNOUSERSITE": "1"})
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=950, env=environment)
    require((output / "result.json").is_file(), "PHASE_DURABLE_RESULT_MISSING")
    proof = read(output / "result.json")
    if result.returncode != 0 or proof.get("status") != "PASS":
        raise PhaseFailure(phase, proof, output)
    return proof


def assert_smoke(proof):
    require(proof.get("measurementsCompleted") == 1, "SMOKE_INFERENCE_COUNT_INVALID")
    # Supervisor CASE_RESULT persistence is the source, never a synthetic
    # success inferred from a zero exit code or a model-ready event alone.


def validate_smoke_result(path):
    case = read(path / "case-1.json")
    result = case.get("result", {})
    shape = result.get("onnxOutputShape")
    require(result.get("status") == "ACOUSTIC_EVIDENCE_AVAILABLE" and isinstance(shape, list)
        and len(shape) == 3 and shape[0] == 1 and shape[1] > 0 and shape[2] == 392
        and result.get("phonemes") and result.get("alignment") and result.get("masteryEligible") is False,
        "SMOKE_ACOUSTIC_OUTPUT_INVALID")


def execute(args):
    # Package verification is safe on this PC; execution is explicitly banned.
    package = verify_package()
    if args.verify_only:
        return {"status": "PACKAGE_VERIFIED_NOT_EXECUTED", "sourceSha": package["sourceSha"],
                "modelLoads": 0, "inferences": 0, "paidCalls": 0}
    require(args.output_dir, "EXCLUSIVE_OUTPUT_DIRECTORY_REQUIRED")
    output = Path(args.output_dir).resolve()
    require(not output.is_relative_to(ENGINE), "BENCHMARK_OUTPUT_MUST_BE_OUTSIDE_SOURCE")
    output.mkdir(parents=True, exist_ok=False)
    environment = {"packageSourceSha": package["sourceSha"], "executionStatus": "NOT_RUN",
        "phaseProofDirectories": [str(output / name) for name in
            ("load", "smoke", "controlled-1", "controlled-2", "controlled-3", "pocketsphinx")]}
    phases, comparisons, baseline = [], [], None
    status, error = "FAIL", None
    sys.path.insert(0, str(HERE))
    from portable_report import build_report
    try:
        lock, model_manifest = read(HERE / "environment.lock.json"), read(HERE / "model-manifest.json")
        node_hash = hashlib.sha256(platform.node().encode()).hexdigest()
        # Ban the original PC before querying/loading native model libraries.
        require(node_hash != lock["benchmarkHostGuard"]["prohibitedNodeSha256"], "CURRENT_PC_BENCHMARK_PROHIBITED")
        require(platform.system() == "Windows", "BENCHMARK_HOST_PLATFORM_UNSUPPORTED")
        hardware = hardware_snapshot()
        environment.update({"hardwareBefore": hardware, "nodeSha256": node_hash, "python": platform.python_version(),
                            "platform": platform.platform(), "architecture": platform.machine(),
                            "cpu": platform.processor(), "threadsPerModel": 1})
        validate_host(lock, hardware, node_hash=node_hash, python_version=platform.python_version(),
                      system=platform.system(), architecture=platform.machine())
        cache = Path(args.cache_dir).resolve() if args.cache_dir else Path.home() / ".cache" / "second-brain-phonetic-v2"
        require(not cache.is_relative_to(ENGINE), "MODEL_CACHE_MUST_BE_OUTSIDE_SOURCE")
        cache.mkdir(parents=True, exist_ok=True)
        environment["diskFreeBeforeBytes"] = shutil.disk_usage(cache).free
        # Scratch budget is an explicit benchmark-only disk envelope, not a
        # measured acoustic requirement, quota or production policy.
        disk_envelope = sum(item["bytes"] for item in model_manifest["artifacts"]) * 3 + 128 * 1024**2
        environment["benchmarkDiskEnvelopeBytes"] = disk_envelope
        require(environment["diskFreeBeforeBytes"] >= disk_envelope, "BENCHMARK_HOST_DISK_INSUFFICIENT")
        deps = cache / "python-deps"
        environment["dependencies"] = prepare_dependencies(deps, lock)
        model = cache / "model"
        require(shutil.disk_usage(cache).free >= sum(item["bytes"] for item in model_manifest["artifacts"]) + 64 * 1024**2,
                "BENCHMARK_HOST_DISK_INSUFFICIENT")
        environment["modelArtifacts"] = fetch_verified_model(model, model_manifest)
        # A preparation/download interval may change RAM. Re-check before load;
        # the unchanged inner supervisor then samples and enforces its own cap.
        validate_host(lock, hardware_snapshot(), node_hash=node_hash, python_version=platform.python_version(),
                      system=platform.system(), architecture=platform.machine())
        metadata = {item["path"]: item["sha256"] for item in model_manifest["artifacts"]
                    if item["path"] in ("config.json", "preprocessor_config.json", "quantize_config.json")}
        metadata_path = output / "audited-metadata.json"
        save(metadata_path, metadata)
        phases.append(run_phase("load", output / "load", model, deps, metadata_path))
        phases.append(run_phase("tiny", output / "smoke", model, deps, metadata_path, prior=output / "load" / "result.json"))
        assert_smoke(phases[-1])
        validate_smoke_result(output / "smoke")
        for index in range(args.repetitions):
            destination = output / ("controlled-" + str(index + 1))
            phases.append(run_phase("benchmark", destination, model, deps, metadata_path,
                                    prior=output / "smoke" / "result.json"))
            comparisons.append(read(destination / "comparison.json"))
        from portable_baseline import run_baseline
        validate_host(lock, hardware_snapshot(), node_hash=node_hash, python_version=platform.python_version(),
                      system=platform.system(), architecture=platform.machine())
        baseline = run_baseline(DATA / "inventory.json", DATA / "baseline-original.json", DATA / "fixtures", deps, output / "pocketsphinx")
        require(baseline.get("status") == "PASS", "POCKETSPHINX_BASELINE_EXECUTION_FAILED")
        environment["executionStatus"] = "COMPLETED_TECHNICAL_BENCHMARK_NOT_CALIBRATION"
        status = "PASS"
    except Exception as failure:
        if isinstance(failure, PhaseFailure):
            phases.append(failure.proof)
            if failure.output_dir is not None:
                environment["failedPhaseProofDirectory"] = str(failure.output_dir)
                if failure.proof.get("phase") == "benchmark":
                    try:
                        comparisons.append(measured_comparison(failure.output_dir, read(DATA / "baseline-original.json")))
                    except Exception:
                        environment["partialComparisonError"] = "PARTIAL_EVIDENCE_REQUIRES_MANUAL_REVIEW"
        # Stable code only. Never persist installer/network/provider bodies.
        error = stable_error(failure)
    try:
        report = build_report(phases, comparisons, None, environment, status=status, error=error)
    except Exception:
        status, error = "FAIL", "FINAL_REPORT_VALIDATION_FAILED"
        report = build_report(phases, [], None, environment, status=status, error=error)
        report["unvalidatedComparisonsPreservedForReview"] = comparisons
    report["pocketSphinxCurrentHost"] = baseline
    if baseline is not None and baseline.get("status") == "PASS":
        try:
            fresh_comparisons = []
            for index in range(len(comparisons)):
                fresh = measured_comparison(output / ("controlled-" + str(index + 1)), baseline)
                fresh["baseline"]["measurementSource"] = "CURRENT_BENCHMARK_HOST_SAME_FROZEN_AUDIO_RERUN"
                fresh_comparisons.append(fresh)
            report["currentHostSideBySide"] = fresh_comparisons
        except Exception:
            status, error = "FAIL", "CURRENT_HOST_COMPARISON_FAILED"
            report.update(status=status, error=error, currentHostSideBySideStatus="FAILED_EVIDENCE_PRESERVED")
    report["productIntegrationAuthorized"] = False
    report["pronunciation90PercentGate"] = "DISABLED"
    report["dedicatedInferenceRequired"] = "NOT_YET_KNOWN"
    report["acousticAcceptanceDecision"] = "EVIDENCE_REVIEW_REQUIRED_NOT_AUTOMATIC"
    save(output / "final-report.json", report)
    return {"status": status, "error": error, "report": str(output / "final-report.json"),
            "sourceSha": package["sourceSha"], "paidCalls": 0, "costUsd": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-package", metavar="NEW_ZIP")
    parser.add_argument("--inventory")
    parser.add_argument("--baseline")
    parser.add_argument("--fixtures-dir")
    parser.add_argument("--dictionary")
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--output-dir")
    parser.add_argument("--cache-dir")
    parser.add_argument("--repetitions", type=int, choices=(3,), default=3,
                        help="Three bounded successful repetitions; never retries after failure.")
    args = parser.parse_args()
    if args.prepare_package:
        require(not args.verify_only and not args.output_dir, "PACKAGING_AND_EXECUTION_MUST_BE_SEPARATE")
        require(all((args.inventory, args.baseline, args.fixtures_dir, args.dictionary)), "PACKAGING_FROZEN_INPUTS_REQUIRED")
        result = prepare_package(args)
    else:
        result = execute(args)
    print(json.dumps(result, allow_nan=False))
    return 1 if result.get("status") == "FAIL" else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BenchmarkStop as failure:
        print(json.dumps({"status": "FAIL", "error": str(failure), "modelLoads": 0, "paidCalls": 0}))
        raise SystemExit(1)
