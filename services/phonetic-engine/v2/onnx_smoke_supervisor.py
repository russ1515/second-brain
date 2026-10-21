"""Local Windows-only ONNX experiment supervisor. Never imports a model runtime.

The 50% reserve is a TEMPORARY experimental containment envelope, not a model
RAM requirement or a production guard. The unchanged FP32 guard is unrelated.
Every heavy child stage requires a durable permission after Job/pressure checks.
No automatic retries, phase chaining, downloads, working-set trims or paging.
"""

from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes as W
import hashlib
import json
import os
from pathlib import Path
import platform
import queue
import re
import subprocess
import sys
import threading
import time
import uuid


POLICY = "TEMPORARY_LOCAL_HALF_AVAILABLE_MINUS_OBSERVED_JITTER_V1_NOT_PRODUCTION"
FROZEN_INVENTORY_SHA = "674a1b7b4aae7561898e798bacab91895467bcc3d9b5307a16faa03934918474"
MAX_LINE = 2 * 1024 * 1024
MEMORY_FLAGS = 0x100 | 0x200 | 0x8 | 0x2000  # process/job commit, active=1, kill-on-close
SIZE = ctypes.c_size_t
U64 = ctypes.c_ulonglong


class SafetyStop(RuntimeError):
    pass


def stable_code(error):
    value = str(error)
    return value if re.fullmatch(r"[A-Z][A-Z0-9_]{0,95}", value) else "SUPERVISOR_FAILURE"


def digest(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(65536), b""):
            result.update(block)
    return result.hexdigest()


def persist(path, value):
    with Path(path).open("x", encoding="utf-8") as output:
        json.dump(value, output, ensure_ascii=False, indent=2, allow_nan=False)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())


def experimental_budget(samples):
    if len(samples) < 3:
        raise SafetyStop("BASELINE_SAMPLE_COUNT_INSUFFICIENT")
    available = [sample["availablePhysicalBytes"] for sample in samples]
    headroom = [sample["commitHeadroomBytes"] for sample in samples]
    if any(sample["lowMemory"] for sample in samples):
        raise SafetyStop("ONNX_INT8_BLOCKED_LOCAL_MEMORY")
    if any(sample["pagesOutputPerSecond"] > 0 for sample in samples):
        raise SafetyStop("BASELINE_PAGING_PRESSURE")
    if any(not isinstance(value, int) or value <= 0 for value in available + headroom):
        raise SafetyStop("MEMORY_MONITOR_INVALID")
    a, h = min(available), min(headroom)
    jitter_a, jitter_h = max(available) - a, max(headroom) - h
    limit = min(a // 2 - jitter_a, h // 2 - jitter_h)
    if limit <= 0:
        raise SafetyStop("BASELINE_MEMORY_UNSTABLE")
    return {"policy": POLICY, "productionPolicy": False, "reserveFraction": 0.5,
            "minimumAvailablePhysicalBytes": a, "minimumCommitHeadroomBytes": h,
            "observedPhysicalJitterBytes": jitter_a, "observedCommitJitterBytes": jitter_h,
            "childTotalCommitLimitBytes": limit, "physicalReserveBytes": a - limit,
            "commitReserveBytes": h - limit, "includesInterpreterCommit": True,
            "measuredModelRequirement": False}


def check_pressure(sample, budget):
    if sample["lowMemory"]:
        raise SafetyStop("OS_LOW_MEMORY_NOTIFICATION")
    if sample["availablePhysicalBytes"] < budget["physicalReserveBytes"]:
        raise SafetyStop("PHYSICAL_RESERVE_REACHED")
    if sample["commitHeadroomBytes"] < budget["commitReserveBytes"]:
        raise SafetyStop("COMMIT_RESERVE_REACHED")
    if (sample["pagesOutputPerSecond"] > 0 and
            sample["availablePhysicalBytes"] < budget["minimumAvailablePhysicalBytes"]):
        raise SafetyStop("NEW_PAGING_PRESSURE")


class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [("dwLength", W.DWORD), ("dwMemoryLoad", W.DWORD)] + [
        (name, U64) for name in ("ullTotalPhys", "ullAvailPhys", "ullTotalPageFile",
        "ullAvailPageFile", "ullTotalVirtual", "ullAvailVirtual", "ullAvailExtendedVirtual")]


class PERFORMANCE_INFORMATION(ctypes.Structure):
    _fields_ = [("cb", W.DWORD)] + [(name, SIZE) for name in (
        "CommitTotal", "CommitLimit", "CommitPeak", "PhysicalTotal", "PhysicalAvailable",
        "SystemCache", "KernelTotal", "KernelPaged", "KernelNonpaged", "PageSize")] + [
        (name, W.DWORD) for name in ("HandleCount", "ProcessCount", "ThreadCount")]


class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
    _fields_ = [("cb", W.DWORD), ("PageFaultCount", W.DWORD)] + [(name, SIZE) for name in (
        "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage",
        "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage", "PagefileUsage",
        "PeakPagefileUsage", "PrivateUsage")]


class JOB_BASIC_LIMIT(ctypes.Structure):
    _fields_ = [("PerProcessUserTimeLimit", ctypes.c_longlong),
        ("PerJobUserTimeLimit", ctypes.c_longlong), ("LimitFlags", W.DWORD),
        ("MinimumWorkingSetSize", SIZE), ("MaximumWorkingSetSize", SIZE),
        ("ActiveProcessLimit", W.DWORD), ("Affinity", SIZE),
        ("PriorityClass", W.DWORD), ("SchedulingClass", W.DWORD)]


class IO_COUNTERS(ctypes.Structure):
    _fields_ = [(name, U64) for name in ("ReadOperationCount", "WriteOperationCount",
        "OtherOperationCount", "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]


class JOB_EXTENDED_LIMIT(ctypes.Structure):
    _fields_ = [("BasicLimitInformation", JOB_BASIC_LIMIT), ("IoInfo", IO_COUNTERS)] + [
        (name, SIZE) for name in ("ProcessMemoryLimit", "JobMemoryLimit",
        "PeakProcessMemoryUsed", "PeakJobMemoryUsed")]


class JOB_ACCOUNTING(ctypes.Structure):
    _fields_ = [(name, ctypes.c_longlong) for name in ("TotalUserTime", "TotalKernelTime",
        "ThisPeriodTotalUserTime", "ThisPeriodTotalKernelTime")] + [
        (name, W.DWORD) for name in ("TotalPageFaultCount", "TotalProcesses", "ActiveProcesses",
        "TotalTerminatedProcesses")]


class PDH_VALUE_UNION(ctypes.Union):
    _fields_ = [("doubleValue", ctypes.c_double), ("longValue", W.LONG)]


class PDH_VALUE(ctypes.Structure):
    _fields_ = [("CStatus", W.DWORD), ("value", PDH_VALUE_UNION)]


class WindowsAPI:
    def __init__(self):
        if os.name != "nt":
            raise SafetyStop("WINDOWS_JOB_REQUIRED")
        self.k = ctypes.WinDLL("kernel32", use_last_error=True)
        self.p = ctypes.WinDLL("psapi", use_last_error=True)
        self.d = ctypes.WinDLL("pdh", use_last_error=True)
        signatures = [
            (self.k, "CreateJobObjectW", [ctypes.c_void_p, W.LPCWSTR], W.HANDLE),
            (self.k, "OpenJobObjectW", [W.DWORD, W.BOOL, W.LPCWSTR], W.HANDLE),
            (self.k, "SetInformationJobObject", [W.HANDLE, ctypes.c_int, ctypes.c_void_p, W.DWORD], W.BOOL),
            (self.k, "QueryInformationJobObject", [W.HANDLE, ctypes.c_int, ctypes.c_void_p, W.DWORD, ctypes.c_void_p], W.BOOL),
            (self.k, "AssignProcessToJobObject", [W.HANDLE, W.HANDLE], W.BOOL),
            (self.k, "IsProcessInJob", [W.HANDLE, W.HANDLE, ctypes.POINTER(W.BOOL)], W.BOOL),
            (self.k, "TerminateJobObject", [W.HANDLE, W.UINT], W.BOOL),
            (self.k, "CloseHandle", [W.HANDLE], W.BOOL),
            (self.k, "GetCurrentProcess", [], W.HANDLE),
            (self.k, "GlobalMemoryStatusEx", [ctypes.POINTER(MEMORYSTATUSEX)], W.BOOL),
            (self.k, "CreateMemoryResourceNotification", [ctypes.c_int], W.HANDLE),
            (self.k, "QueryMemoryResourceNotification", [W.HANDLE, ctypes.POINTER(W.BOOL)], W.BOOL),
            (self.p, "GetPerformanceInfo", [ctypes.POINTER(PERFORMANCE_INFORMATION), W.DWORD], W.BOOL),
            (self.p, "GetProcessMemoryInfo", [W.HANDLE, ctypes.c_void_p, W.DWORD], W.BOOL),
            (self.d, "PdhOpenQueryW", [W.LPCWSTR, SIZE, ctypes.POINTER(W.HANDLE)], W.LONG),
            (self.d, "PdhAddEnglishCounterW", [W.HANDLE, W.LPCWSTR, SIZE, ctypes.POINTER(W.HANDLE)], W.LONG),
            (self.d, "PdhCollectQueryData", [W.HANDLE], W.LONG),
            (self.d, "PdhGetFormattedCounterValue", [W.HANDLE, W.DWORD, ctypes.c_void_p, ctypes.POINTER(PDH_VALUE)], W.LONG),
            (self.d, "PdhCloseQuery", [W.HANDLE], W.LONG),
        ]
        for dll, name, arguments, result in signatures:
            function = getattr(dll, name)
            function.argtypes, function.restype = arguments, result

    @staticmethod
    def require(result, code):
        if not result:
            raise SafetyStop(code)

    def job_info(self, handle):
        limits = JOB_EXTENDED_LIMIT()
        self.require(self.k.QueryInformationJobObject(handle, 9, ctypes.byref(limits),
            ctypes.sizeof(limits), None), "JOB_QUERY_FAILED")
        return limits

    def verify_job(self, handle, process, budget):
        inside = W.BOOL()
        self.require(self.k.IsProcessInJob(process, handle, ctypes.byref(inside)), "JOB_MEMBERSHIP_QUERY_FAILED")
        limits = self.job_info(handle)
        if (not inside.value or limits.BasicLimitInformation.LimitFlags != MEMORY_FLAGS or
                limits.BasicLimitInformation.ActiveProcessLimit != 1 or
                limits.ProcessMemoryLimit != budget or limits.JobMemoryLimit != budget):
            raise SafetyStop("JOB_CONFINEMENT_NOT_ENFORCED")
        return {"flags": limits.BasicLimitInformation.LimitFlags, "activeProcessLimit": 1,
                "processCommitLimitBytes": limits.ProcessMemoryLimit,
                "jobCommitLimitBytes": limits.JobMemoryLimit, "membershipVerified": True}


class WindowsJob:
    def __init__(self, api, limit):
        self.api, self.limit = api, limit
        self.name = "Local\\SecondBrainOnnxExperiment-" + uuid.uuid4().hex
        self.handle = api.k.CreateJobObjectW(None, self.name)
        api.require(self.handle, "JOB_CREATE_FAILED")
        limits = JOB_EXTENDED_LIMIT()
        limits.BasicLimitInformation.LimitFlags = MEMORY_FLAGS
        limits.BasicLimitInformation.ActiveProcessLimit = 1
        limits.ProcessMemoryLimit = limits.JobMemoryLimit = limit
        try:
            api.require(api.k.SetInformationJobObject(self.handle, 9, ctypes.byref(limits),
                ctypes.sizeof(limits)), "JOB_LIMIT_CONFIGURATION_FAILED")
        except Exception:
            self.close()
            raise

    def assign(self, process):
        self.api.require(self.api.k.AssignProcessToJobObject(self.handle, int(process._handle)), "JOB_ASSIGNMENT_FAILED")
        return self.verify(process)

    def verify(self, process):
        return self.api.verify_job(self.handle, int(process._handle), self.limit)

    def accounting(self):
        value = JOB_ACCOUNTING()
        self.api.require(self.api.k.QueryInformationJobObject(self.handle, 1, ctypes.byref(value),
            ctypes.sizeof(value), None), "JOB_ACCOUNTING_FAILED")
        limits = self.api.job_info(self.handle)
        return {"activeProcesses": value.ActiveProcesses,
                "peakProcessCommitBytes": limits.PeakProcessMemoryUsed,
                "peakJobCommitBytes": limits.PeakJobMemoryUsed}

    def terminate(self):
        self.api.require(self.api.k.TerminateJobObject(self.handle, 71), "JOB_TERMINATION_FAILED")

    def wait_empty(self, timeout=2):
        # Accounting removal may trail the process wait signal briefly. This is
        # bounded release observation, never another model/inference attempt.
        deadline = time.monotonic() + timeout
        value = self.accounting()
        while value["activeProcesses"] and time.monotonic() < deadline:
            time.sleep(0.05)
            value = self.accounting()
        return value

    def close(self):
        if self.handle:
            self.api.k.CloseHandle(self.handle)
            self.handle = None


def verify_own_job(job_name, limit, phase):
    api = WindowsAPI()
    handle = api.k.OpenJobObjectW(0x4, False, job_name)  # query-only, not inheritable
    api.require(handle, "CHILD_JOB_OPEN_FAILED")
    try:
        api.verify_job(handle, api.k.GetCurrentProcess(), limit)
        return {"verified": True, "osMemoryLimitEnforced": True, "phase": phase}
    finally:
        # Never retain the parent's job handle in the child: parent death must
        # close the last handle and terminate this single experimental process.
        api.k.CloseHandle(handle)


class WindowsMemoryMonitor:
    def __init__(self, api):
        self.api, self.query, self.counter, self.notification = api, W.HANDLE(), W.HANDLE(), None
        try:
            self.notification = api.k.CreateMemoryResourceNotification(0)
            api.require(self.notification, "LOW_MEMORY_NOTIFICATION_UNAVAILABLE")
            if api.d.PdhOpenQueryW(None, 0, ctypes.byref(self.query)) != 0:
                raise SafetyStop("PAGING_MONITOR_UNAVAILABLE")
            if api.d.PdhAddEnglishCounterW(self.query, "\\Memory\\Pages Output/sec", 0,
                    ctypes.byref(self.counter)) != 0:
                raise SafetyStop("PAGING_MONITOR_UNAVAILABLE")
            if api.d.PdhCollectQueryData(self.query) != 0:
                raise SafetyStop("PAGING_MONITOR_UNAVAILABLE")
        except Exception:
            self.close()
            raise

    def sample(self, process=None):
        api = self.api
        memory, performance, low, pageout = MEMORYSTATUSEX(), PERFORMANCE_INFORMATION(), W.BOOL(), PDH_VALUE()
        memory.dwLength, performance.cb = ctypes.sizeof(memory), ctypes.sizeof(performance)
        api.require(api.k.GlobalMemoryStatusEx(ctypes.byref(memory)), "PHYSICAL_MEMORY_MONITOR_FAILED")
        api.require(api.p.GetPerformanceInfo(ctypes.byref(performance), ctypes.sizeof(performance)), "COMMIT_MONITOR_FAILED")
        api.require(api.k.QueryMemoryResourceNotification(self.notification, ctypes.byref(low)), "LOW_MEMORY_MONITOR_FAILED")
        if (api.d.PdhCollectQueryData(self.query) != 0 or
                api.d.PdhGetFormattedCounterValue(self.counter, 0x200, None, ctypes.byref(pageout)) != 0 or
                pageout.CStatus not in (0, 1) or not 0 <= pageout.value.doubleValue < float("inf")):
            raise SafetyStop("PAGING_MONITOR_FAILED")
        result = {"monotonicSeconds": time.monotonic(), "availablePhysicalBytes": memory.ullAvailPhys,
                  "totalPhysicalBytes": memory.ullTotalPhys,
                  "commitHeadroomBytes": (performance.CommitLimit - performance.CommitTotal) * performance.PageSize,
                  "lowMemory": bool(low.value), "pagesOutputPerSecond": pageout.value.doubleValue}
        if process is not None:
            counters = PROCESS_MEMORY_COUNTERS_EX()
            counters.cb = ctypes.sizeof(counters)
            api.require(api.p.GetProcessMemoryInfo(int(process._handle), ctypes.byref(counters),
                ctypes.sizeof(counters)), "CHILD_MEMORY_MONITOR_FAILED")
            result["child"] = {"workingSetBytes": counters.WorkingSetSize,
                "peakWorkingSetBytes": counters.PeakWorkingSetSize, "privateCommitBytes": counters.PrivateUsage,
                "peakPrivateCommitBytes": counters.PeakPagefileUsage,
                "pageFaultCountNotHardPagingCount": counters.PageFaultCount}
        return result

    def close(self):
        if self.query:
            self.api.d.PdhCloseQuery(self.query)
            self.query = W.HANDLE()
        if self.notification:
            self.api.k.CloseHandle(self.notification)
            self.notification = None


def fingerprint(model_dir, dictionary, deps_dir, metadata_hashes):
    source = Path(__file__).resolve().parent
    names = ["onnx_smoke_supervisor.py", "onnx_child.py", "onnx_runtime.py", "mapper.py",
             "ctc_alignment.py", "scorer.py", "runtime.py", "../phonetic_engine.py",
             "../tests/run_v2_acceptance.py"]
    artifacts = {name: digest(Path(model_dir) / name) for name in
                 ["model_int8.onnx", "vocab.json", *sorted(metadata_hashes)]}
    if any(artifacts[name] != value for name, value in metadata_hashes.items()):
        raise SafetyStop("ONNX_METADATA_HASH_MISMATCH")
    machine = {"nodeHash": hashlib.sha256(platform.node().encode()).hexdigest(),
               "platform": platform.platform(), "architecture": platform.machine(),
               "python": sys.version, "executableSha256": digest(sys.executable)}
    return {"machine": machine, "sourceHashes": {name: digest(source / name) for name in names},
            "artifactHashes": artifacts, "dictionarySha256": digest(dictionary),
            "dependencyEntryHashes": {name: digest(Path(deps_dir) / name) for name in
                ["onnxruntime/__init__.py", "numpy/__init__.py"]},
            "options": {"policy": POLICY, "cpuProviderOnly": True, "threads": 1,
                        "nativeImportsOnlyInConfinedChild": True}}


def validate_prior_gate(prior, phase, identity):
    expected = {"tiny": "load", "benchmark": "tiny"}.get(phase)
    if expected is None:
        if prior is not None:
            raise SafetyStop("LOAD_PHASE_PRIOR_GATE_NOT_ALLOWED")
        return
    if (not isinstance(prior, dict) or prior.get("status") != "PASS" or prior.get("phase") != expected
            or prior.get("fingerprint") != identity or prior.get("release", {}).get("activeProcessesAfterExit") != 0
            or prior.get("safety", {}).get("osMemoryLimitEnforced") is not True
            or prior.get("safety", {}).get("monitorFailures") != 0):
        raise SafetyStop("PRIOR_PHASE_GATE_NOT_VERIFIED")


def load_controlled_cases(inventory_path, baseline_path, phase, fixture_root=None):
    if digest(inventory_path) != FROZEN_INVENTORY_SHA:
        raise SafetyStop("CONTROLLED_INVENTORY_HASH_MISMATCH")
    inventory = json.loads(Path(inventory_path).read_text(encoding="utf-8"))
    if (inventory.get("caseCount") != 15 or len(inventory.get("cases", [])) != 15 or
            digest(baseline_path) != inventory.get("baselineSha256")):
        raise SafetyStop("CONTROLLED_BASELINE_HASH_MISMATCH")
    baseline = json.loads(Path(baseline_path).read_text(encoding="utf-8"))
    previous = {row["id"]: row for row in baseline["cases"]}
    # Pure test manifest only. Gold/category/synthetic spoken text never enter
    # the child payload, classifier, posterior source or scorer.
    resolved = {}
    root = Path(fixture_root).resolve(strict=True) if fixture_root is not None else None
    for case in inventory["cases"]:
        # The original inventory and its gold remain byte-identical. Only an
        # execution path is rebound, never text, gold, identity or observations.
        name = case["audioPath"].replace("\\", "/").rsplit("/", 1)[-1]
        path = root / name if root is not None else Path(case["audioPath"])
        if path.is_symlink() or not path.is_file():
            raise SafetyStop("CONTROLLED_FIXTURE_PATH_INVALID")
        if root is not None and path.resolve().parent != root:
            raise SafetyStop("CONTROLLED_FIXTURE_PATH_INVALID")
        resolved[case["id"]] = str(path.resolve())
        if (digest(path) != case["fixtureSha256"] or
                previous[case["id"]]["fixtureSha256"] != case["fixtureSha256"] or
                previous[case["id"]]["expectedText"] != case["expectedText"]):
            raise SafetyStop("CONTROLLED_FIXTURE_HASH_MISMATCH")
    selected = inventory["cases"] if phase == "benchmark" else [inventory["cases"][0]]
    if phase == "tiny" and (selected[0]["category"] != "REFERENCE" or selected[0]["audio"]["durationMs"] > 3000):
        raise SafetyStop("TINY_FROZEN_REFERENCE_INVALID")
    payload = []
    for case in selected:
        old = previous[case["id"]].get("result", {})
        payload.append({"id": case["id"], "audioPath": resolved[case["id"]],
            "fixtureSha256": case["fixtureSha256"], "expectedText": case["expectedText"],
            "baselineCompleteness": old.get("completeness"), "baselineFluency": old.get("fluency")})
    return inventory, baseline, payload


def stream_reader(stream, events, label):
    try:
        while True:
            line = stream.readline(MAX_LINE + 1)
            if not line:
                break
            if len(line) > MAX_LINE:
                events.put(("PROTOCOL_ERROR", "CHILD_PROTOCOL_LINE_TOO_LARGE"), timeout=1)
                return
            events.put((label, line), timeout=1)
        events.put(("EOF", None), timeout=1)
    except Exception:
        try:
            events.put(("PROTOCOL_ERROR", "CHILD_OUTPUT_MONITOR_FAILED"), timeout=1)
        except queue.Full:
            pass


def discard_stderr(stream, counter):
    # Only a byte count is retained, never arbitrary runtime logs or environment.
    for block in iter(lambda: stream.read(4096), b""):
        counter[0] += len(block)


def decode_event(line):
    try:
        value = json.loads(line)
    except (ValueError, UnicodeError):
        raise SafetyStop("CHILD_PROTOCOL_INVALID") from None
    if not isinstance(value, dict) or value.get("type") not in {
            "BOOT_READY", "GUARD_REQUEST", "MODEL_LOADED", "CASE_RESULT", "COMPLETE", "ERROR"}:
        raise SafetyStop("CHILD_PROTOCOL_INVALID")
    return value


def supervise(args):
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=False)
    report = {"phase": args.phase, "status": "FAIL", "modelLoad": "NOT_RUN", "paidCalls": 0,
        "costUsd": 0, "safety": {"osMemoryLimitEnforced": False, "monitorFailures": 0},
        "experimentalOnly": True, "fp32GuardUnchanged": True}
    process = job = monitor = None
    events, stderr_count, samples, measurements = queue.Queue(maxsize=32), [0], [], []
    completed = assigned = False
    journal = (output / "stages.jsonl").open("x", encoding="utf-8", buffering=1)

    def record(event):
        journal.write(json.dumps({"timeMonotonic": time.monotonic(), **event}, allow_nan=False) + "\n")
        journal.flush()
        os.fsync(journal.fileno())

    def send(value):
        process.stdin.write((json.dumps(value, allow_nan=False) + "\n").encode())
        process.stdin.flush()

    try:
        if not args.provenance_verified:
            raise SafetyStop("ONNX_MODEL_PROVENANCE_REQUIRED")
        metadata = json.loads(Path(args.metadata_hashes).read_text(encoding="utf-8"))
        if (not isinstance(metadata, dict) or not {"config.json", "preprocessor_config.json", "quantize_config.json"}.issubset(metadata)
                or any(not re.fullmatch(r"[a-z_]+\.json", name) or not re.fullmatch(r"[a-f0-9]{64}", value)
                       for name, value in metadata.items())):
            raise SafetyStop("ONNX_AUDITED_METADATA_REQUIRED")
        identity = fingerprint(args.model_dir, args.dictionary, args.deps_dir, metadata)
        report["fingerprint"] = identity
        prior = json.loads(Path(args.prior_gate).read_text(encoding="utf-8")) if args.prior_gate else None
        validate_prior_gate(prior, args.phase, identity)
        inventory = baseline = None
        cases = []
        if args.phase != "load":
            if not args.inventory or not args.baseline:
                raise SafetyStop("CONTROLLED_FIXTURES_REQUIRED")
            inventory, baseline, cases = load_controlled_cases(args.inventory, args.baseline, args.phase,
                getattr(args, "fixture_root", None))
        api = WindowsAPI()
        monitor = WindowsMemoryMonitor(api)
        baseline_samples = []
        report["baseline"] = baseline_samples
        for _ in range(args.baseline_samples):
            time.sleep(1)
            baseline_samples.append(monitor.sample())
        persist(output / "baseline.json", baseline_samples)
        budget = experimental_budget(baseline_samples)
        report["budget"] = budget
        record({"type": "BASELINE_ACCEPTED", "budget": budget})
        job = WindowsJob(api, budget["childTotalCommitLimitBytes"])
        environment = dict(os.environ)
        environment.update({"OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1", "MKL_NUM_THREADS": "1",
            "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "PYTHONNOUSERSITE": "1"})
        process = subprocess.Popen([sys.executable, "-S", "-u", str(Path(__file__).with_name("onnx_child.py"))],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env=environment, creationflags=subprocess.CREATE_NO_WINDOW)
        # This interpreter is stdlib-only and blocked on stdin. A failed attach
        # never grants START or imports native dependencies.
        report["jobProof"] = job.assign(process)
        assigned = True
        report["safety"]["osMemoryLimitEnforced"] = True
        threading.Thread(target=stream_reader, args=(process.stdout, events, "STDOUT"), daemon=True).start()
        threading.Thread(target=discard_stderr, args=(process.stderr, stderr_count), daemon=True).start()
        deadline = time.monotonic() + args.timeout_sec
        stage = "BOOT"
        expected_request = 0
        got_start = got_load = stdout_ended = False
        last_sample = 0
        while process.poll() is None or not stdout_ended:
            if time.monotonic() > deadline:
                raise SafetyStop("EXPERIMENT_PHASE_TIMEOUT")
            if time.monotonic() - last_sample >= 0.25 and process.poll() is None:
                sample = monitor.sample(process)
                sample["stage"] = stage
                samples.append(sample)
                check_pressure(sample, budget)
                job.verify(process)
                last_sample = time.monotonic()
            try:
                label, line = events.get(timeout=0.05)
            except queue.Empty:
                continue
            if label == "PROTOCOL_ERROR":
                raise SafetyStop(line)
            if label == "EOF":
                stdout_ended = True
                continue
            event = decode_event(line)
            kind = event["type"]
            if kind == "BOOT_READY":
                if got_start:
                    raise SafetyStop("CHILD_PROTOCOL_DUPLICATE_START")
                got_start = True
                record({"type": "START_AUTHORIZED", "jobProof": job.verify(process)})
                send({"command": "START", "phase": args.phase, "jobName": job.name,
                    "memoryLimitBytes": job.limit, "modelDir": str(Path(args.model_dir).resolve()),
                    "dictionary": str(Path(args.dictionary).resolve()), "depsDir": str(Path(args.deps_dir).resolve()),
                    "metadataHashes": metadata, "provenanceVerified": True, "cases": cases})
            elif kind == "GUARD_REQUEST":
                expected_request += 1
                allowed_stages = {"before_runtime_import", "before_hash_verification", "before_native_import",
                    "before_session_load", "after_session_load"}
                if got_load and args.phase != "load":
                    allowed_stages |= {"before_audio_preprocessing", "before_inference", "after_inference", "after_scoring"}
                if (not got_start or event.get("phase") != args.phase or event.get("sequence") != expected_request
                        or event.get("stage") not in allowed_stages):
                    raise SafetyStop("CHILD_GUARD_PROTOCOL_INVALID")
                sample = monitor.sample(process)
                check_pressure(sample, budget)
                stage = event["stage"]
                sample["stage"] = stage
                samples.append(sample)
                record({"type": "STAGE_AUTHORIZED", "stage": stage, "sequence": expected_request,
                        "memory": sample, "job": job.verify(process)})
                send({"command": "AUTHORIZE", "sequence": expected_request, "phase": args.phase})
            elif kind == "MODEL_LOADED":
                if got_load or not got_start:
                    raise SafetyStop("CHILD_LOAD_PROTOCOL_INVALID")
                got_load = True
                report["modelLoad"], report["loadMetrics"] = "PASS", event["metrics"]
                record(event)
            elif kind == "CASE_RESULT":
                index = len(measurements)
                value = event.get("measurement", {})
                if (not got_load or args.phase == "load" or index >= len(cases) or
                        value.get("id") != cases[index]["id"] or
                        value.get("fixtureSha256") != cases[index]["fixtureSha256"]):
                    raise SafetyStop("CHILD_CASE_PROTOCOL_INVALID")
                value["parentObservedPeakWorkingSetBytes"] = max(
                    (row.get("child", {}).get("peakWorkingSetBytes", 0) for row in samples), default=0)
                # Canonical A/B metric is CHILD resident peak, never parent RSS.
                value["peakProcessMemoryBytes"] = value["parentObservedPeakWorkingSetBytes"]
                measurements.append(value)
                persist(output / ("case-" + str(index + 1) + ".json"), value)
                if "executionError" in value:
                    raise SafetyStop("CONTROLLED_CASE_EXECUTION_FAILED")
            elif kind == "ERROR":
                raise SafetyStop(stable_code(event.get("code", "ONNX_CHILD_FAILURE")))
            elif kind == "COMPLETE":
                if (completed or not got_load or len(measurements) != len(cases) or
                        event.get("phase") != args.phase or event.get("assessmentCalls") != len(cases)):
                    raise SafetyStop("CHILD_COMPLETION_PROTOCOL_INVALID")
                completed = True
                report["childCompletion"] = event
                record(event)
        process.wait(timeout=5)
        if not completed or process.returncode != 0:
            raise SafetyStop("CHILD_EXIT_WITHOUT_SUCCESS")
        report["status"] = "PASS"
        if args.phase == "benchmark":
            sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tests"))
            from run_v2_acceptance import comparison_report  # pure stdlib report only
            persist(output / "comparison.json", comparison_report(inventory, baseline, measurements))
    except Exception as error:
        report["status"], report["error"] = "FAIL", stable_code(error)
        if any(fragment in report["error"] for fragment in ("MONITOR", "NOTIFICATION_UNAVAILABLE", "PAGING_MONITOR")):
            report["safety"]["monitorFailures"] += 1
        record({"type": "STOP", "code": report["error"], "noRetry": True})
    finally:
        try:
            if process is not None and process.poll() is None:
                if job is not None and assigned:
                    job.terminate()
                else:
                    # Only the stdlib boot child, never START-authorized.
                    process.kill()
                process.wait(timeout=10)
            if job is not None:
                accounting = job.wait_empty()
                report["release"] = {"activeProcessesAfterExit": accounting["activeProcesses"],
                    "job": accounting, "childExitCode": process.returncode if process else None,
                    "processExited": process is not None and process.returncode is not None,
                    "processMemoryReleased": accounting["activeProcesses"] == 0 and
                        process is not None and process.returncode is not None,
                    "systemRamMayVaryWithOtherApplicationsAndFileCache": True}
                if accounting["activeProcesses"] != 0 or process is None or process.returncode is None:
                    report["status"], report["error"] = "FAIL", "CHILD_MEMORY_RELEASE_NOT_VERIFIED"
            if monitor is not None:
                time.sleep(1)
                report["systemAfterExit"] = monitor.sample()
                if "budget" in report:
                    check_pressure(report["systemAfterExit"], report["budget"])
        except Exception as error:
            report["status"], report["error"] = "FAIL", stable_code(error)
            report["safety"]["monitorFailures"] += 1
        finally:
            if job is not None:
                job.close()  # KILL_ON_JOB_CLOSE remains enforced even on errors.
            if monitor is not None:
                monitor.close()
            if process is not None:
                for stream in (process.stdin, process.stdout, process.stderr):
                    if stream:
                        stream.close()
            if not (output / "baseline.json").exists() and "baseline" in report:
                persist(output / "baseline.json", report["baseline"])
            report["stderrBytesDiscardedNotLogged"] = stderr_count[0]
            report["resourceSamples"] = samples
            report["measurementsCompleted"] = len(measurements)
            persist(output / "result.json", report)
            journal.close()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=("load", "tiny", "benchmark"), required=True)
    for name in ("model-dir", "dictionary", "deps-dir", "output-dir", "metadata-hashes"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--provenance-verified", action="store_true")
    parser.add_argument("--prior-gate")
    parser.add_argument("--inventory")
    parser.add_argument("--baseline")
    parser.add_argument("--fixture-root", help="Rebind execution paths only; frozen inventory remains unchanged")
    parser.add_argument("--baseline-samples", type=int, default=6, choices=range(3, 11))
    parser.add_argument("--timeout-sec", type=int, default=300, choices=range(30, 901), metavar="SECONDS")
    args = parser.parse_args()
    result = supervise(args)
    print(json.dumps({"phase": args.phase, "status": result["status"], "error": result.get("error"),
                      "resultFile": str(Path(args.output_dir).resolve() / "result.json")}))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
