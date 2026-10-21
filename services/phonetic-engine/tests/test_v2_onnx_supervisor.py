"""No ONNX/model loads: pure safety logic and tiny stdlib Windows children only."""

import ast
import importlib.util
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time
import unittest


SUPERVISOR = Path(__file__).resolve().parents[1] / "v2" / "onnx_smoke_supervisor.py"
CHILD = SUPERVISOR.with_name("onnx_child.py")
spec = importlib.util.spec_from_file_location("onnx_smoke_supervisor_test", SUPERVISOR)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


def sample(available=10000, headroom=20000, low=False, pageout=0):
    return {"availablePhysicalBytes": available, "commitHeadroomBytes": headroom,
            "lowMemory": low, "pagesOutputPerSecond": pageout}


class BudgetTests(unittest.TestCase):
    def test_temporary_relative_half_minus_actual_jitter(self):
        budget = s.experimental_budget([sample(10000), sample(11000), sample(12000)])
        self.assertEqual(budget["childTotalCommitLimitBytes"], 3000)
        self.assertEqual(budget["physicalReserveBytes"], 7000)
        self.assertFalse(budget["productionPolicy"])
        self.assertFalse(budget["measuredModelRequirement"])

    def test_commit_headroom_is_independent_limit(self):
        self.assertEqual(s.experimental_budget([sample(headroom=4000)] * 3)["childTotalCommitLimitBytes"], 2000)

    def test_no_fixed_megabyte_threshold(self):
        for amount in (100, 1000, 10**9):
            self.assertEqual(s.experimental_budget([sample(amount, amount * 2)] * 3)
                             ["childTotalCommitLimitBytes"], amount // 2)

    def test_low_memory_baseline_stops(self):
        with self.assertRaisesRegex(s.SafetyStop, "BLOCKED_LOCAL_MEMORY"):
            s.experimental_budget([sample(low=True)] * 3)

    def test_baseline_pageouts_stop_before_child(self):
        with self.assertRaisesRegex(s.SafetyStop, "BASELINE_PAGING_PRESSURE"):
            s.experimental_budget([sample(pageout=0.1)] * 3)

    def test_jitter_may_consume_budget_not_silently_raise_it(self):
        with self.assertRaisesRegex(s.SafetyStop, "BASELINE_MEMORY_UNSTABLE"):
            s.experimental_budget([sample(100), sample(1000), sample(100)])

    def test_insufficient_samples_fail_closed(self):
        with self.assertRaises(s.SafetyStop):
            s.experimental_budget([sample()])

    def test_all_pressure_sources_stop(self):
        budget = s.experimental_budget([sample()] * 3)
        for value, code in [(sample(low=True), "OS_LOW_MEMORY"),
                            (sample(4999), "PHYSICAL_RESERVE"),
                            (sample(headroom=14999), "COMMIT_RESERVE"),
                            (sample(9999, pageout=1), "NEW_PAGING")]:
            with self.subTest(code=code), self.assertRaisesRegex(s.SafetyStop, code):
                s.check_pressure(value, budget)

    def test_cold_reads_not_mislabeled_as_pageouts(self):
        budget = s.experimental_budget([sample()] * 3)
        s.check_pressure({**sample(), "pagesInputPerSecond": 10000}, budget)


class GateAndProtocolTests(unittest.TestCase):
    def prior(self, phase="load"):
        return {"phase": phase, "status": "PASS", "fingerprint": {"identity": "same"},
                "release": {"activeProcessesAfterExit": 0},
                "safety": {"osMemoryLimitEnforced": True, "monitorFailures": 0}}

    def test_prior_requires_correct_phase_and_same_identity(self):
        s.validate_prior_gate(self.prior(), "tiny", {"identity": "same"})
        s.validate_prior_gate(self.prior("tiny"), "benchmark", {"identity": "same"})
        for prior in (None, self.prior("benchmark"), {**self.prior(), "status": "FAIL"},
                      {**self.prior(), "fingerprint": {"identity": "other"}},
                      {**self.prior(), "release": {"activeProcessesAfterExit": 1}},
                      {**self.prior(), "safety": {"osMemoryLimitEnforced": False, "monitorFailures": 0}}):
            with self.subTest(prior=prior), self.assertRaises(s.SafetyStop):
                s.validate_prior_gate(prior, "tiny", {"identity": "same"})

    def test_load_cannot_take_prior_gate(self):
        s.validate_prior_gate(None, "load", {})
        with self.assertRaises(s.SafetyStop):
            s.validate_prior_gate(self.prior(), "load", {})

    def test_untrusted_or_secret_error_text_not_persisted(self):
        self.assertEqual(s.stable_code(ValueError("password=do-not-log")), "SUPERVISOR_FAILURE")
        self.assertEqual(s.stable_code(ValueError("ONNX_SESSION_LOAD_FAILED")), "ONNX_SESSION_LOAD_FAILED")

    def test_protocol_rejects_invalid_messages(self):
        for line in ('not json', '[]', '{"type":"UNRESTRICTED_RETRY"}'):
            with self.assertRaises(s.SafetyStop):
                s.decode_event(line)

    def test_bounded_reader_stops_oversized_line(self):
        import io
        events = queue.Queue()
        s.stream_reader(io.BytesIO(b"x" * (s.MAX_LINE + 1)), events, "STDOUT")
        self.assertEqual(events.get()[0], "PROTOCOL_ERROR")

    def test_reader_emits_eof_after_last_result(self):
        import io
        events = queue.Queue()
        s.stream_reader(io.BytesIO(b'{"type":"COMPLETE"}\n'), events, "STDOUT")
        self.assertEqual(events.get()[0], "STDOUT")
        self.assertEqual(events.get()[0], "EOF")

    def test_evidence_files_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "proof.json"
            s.persist(target, {"status": "FAIL"})
            with self.assertRaises(FileExistsError):
                s.persist(target, {"status": "PASS"})

    def test_parent_and_boot_child_have_no_native_top_level_import(self):
        forbidden = {"onnxruntime", "numpy", "torch", "transformers", "v2.onnx_runtime"}
        for path in (SUPERVISOR, CHILD):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in tree.body:
                modules = [alias.name for alias in node.names] if isinstance(node, ast.Import) else [node.module] if isinstance(node, ast.ImportFrom) else []
                self.assertFalse(forbidden.intersection(modules))
        parent_source = SUPERVISOR.read_text(encoding="utf-8")
        self.assertNotIn("execute_runtime(", parent_source)
        self.assertNotIn("EmptyWorkingSet", parent_source)
        self.assertNotIn("NtResumeProcess", parent_source)

    def test_child_without_start_exits_without_loading_anything(self):
        process = subprocess.Popen([sys.executable, "-S", "-u", str(CHILD)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            output, errors = process.communicate(b"", timeout=10)
            lines = [json.loads(line) for line in output.splitlines()]
            self.assertEqual(lines[0], {"type": "BOOT_READY", "stdlibOnly": True, "nativeImported": False})
            self.assertEqual(lines[-1]["code"], "CHILD_PERMISSION_CHANNEL_CLOSED")
            self.assertEqual(process.returncode, 1)
            self.assertEqual(errors, b"")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)


@unittest.skipUnless(os.name == "nt", "Windows native Job/PDH proof requires Windows")
class WindowsConfinementTests(unittest.TestCase):
    def test_10mib_job_denies_one_oversized_stdlib_allocation(self):
        api, limit = s.WindowsAPI(), 10 * 1024 * 1024
        job = s.WindowsJob(api, limit)
        code = ("import sys\nprint('READY',flush=True)\nsys.stdin.readline()\n"
                "try:\n a=bytearray(12*1024*1024)\n print('UNEXPECTED',flush=True)\n"
                "except MemoryError:\n print('CAPPED',flush=True)\n")
        process = subprocess.Popen([sys.executable, "-S", "-u", "-c", code],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW)
        assigned = False
        try:
            self.assertEqual(process.stdout.readline().strip(), b"READY")
            proof = job.assign(process)
            assigned = True
            self.assertTrue(proof["membershipVerified"])
            self.assertEqual(proof["jobCommitLimitBytes"], limit)
            output, _ = process.communicate(b"GO\n", timeout=10)
            self.assertEqual(output.strip(), b"CAPPED")
            self.assertEqual(process.returncode, 0)
            self.assertEqual(job.wait_empty()["activeProcesses"], 0)
        finally:
            if process.poll() is None:
                job.terminate() if assigned else process.kill()
                process.wait(timeout=5)
            job.close()
            for stream in (process.stdin, process.stdout, process.stderr):
                stream.close()

    def test_kill_on_close_releases_only_this_waiting_child(self):
        api = s.WindowsAPI()
        job = s.WindowsJob(api, 10 * 1024 * 1024)
        process = subprocess.Popen([sys.executable, "-S", "-u", "-c",
            "import sys; print('READY',flush=True); sys.stdin.readline()"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            self.assertEqual(process.stdout.readline().strip(), b"READY")
            job.assign(process)
            self.assertIsNone(process.poll())
            self.assertFalse(process.stdin.closed)
            job.close()
            process.wait(timeout=5)
            # Windows Job last-handle termination may report ERROR_SUCCESS=0;
            # exiting while its open stdin is still blocked is the actual proof.
            self.assertIsNotNone(process.returncode)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)
            job.close()
            for stream in (process.stdin, process.stdout, process.stderr):
                stream.close()

    def test_monitor_reports_native_physical_commit_low_memory_and_pageouts(self):
        monitor = s.WindowsMemoryMonitor(s.WindowsAPI())
        try:
            time.sleep(1)
            value = monitor.sample()
            self.assertGreater(value["availablePhysicalBytes"], 0)
            self.assertGreater(value["commitHeadroomBytes"], 0)
            self.assertIsInstance(value["lowMemory"], bool)
            self.assertGreaterEqual(value["pagesOutputPerSecond"], 0)
        finally:
            monitor.close()

    def test_child_guard_cannot_claim_parent_is_in_other_job(self):
        api = s.WindowsAPI()
        job = s.WindowsJob(api, 10 * 1024 * 1024)
        try:
            with self.assertRaisesRegex(s.SafetyStop, "JOB_CONFINEMENT_NOT_ENFORCED"):
                s.verify_own_job(job.name, job.limit, "load")
        finally:
            job.close()


if __name__ == "__main__":
    unittest.main()
