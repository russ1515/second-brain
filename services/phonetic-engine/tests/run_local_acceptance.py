"""Offline synthetic-fixture smoke, not human pronunciation validation.

Only use a directory of authorized technical fixtures. No provider is called.
The fixed test phrase is a fixture specification, never scoring logic.
"""

import argparse
import base64
import ctypes
import json
import os
from pathlib import Path
import random
import statistics
import sys
import time
import wave
import io
import array

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phonetic_engine import PhoneticEngine


def peak_memory_bytes():
    if os.name == "nt":
        from ctypes import wintypes

        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
                (key, ctypes.c_size_t) for key in ("PeakWorkingSetSize", "WorkingSetSize",
                "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage",
                "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]

        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        kernel = ctypes.windll.kernel32
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        query = ctypes.windll.psapi.GetProcessMemoryInfo
        query.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessMemoryCounters), wintypes.DWORD]
        if query(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            return counters.PeakWorkingSetSize
        return None
    try:
        import resource
        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return value if sys.platform == "darwin" else value * 1024
    except (ImportError, OSError):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path, required=True)
    arguments = parser.parse_args()
    cases = []
    source = (arguments.fixtures / "reference.wav").read_bytes()
    with wave.open(io.BytesIO(source), "rb") as reference:
        assert reference.getframerate() == 16000 and reference.getnchannels() == 1 and reference.getsampwidth() == 2
        samples = array.array("h", reference.readframes(reference.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()

    def make_wav(values):
        binary = array.array("h", values)
        if sys.byteorder != "little":
            binary.byteswap()
        output = io.BytesIO()
        with wave.open(output, "wb") as writer:
            writer.setnchannels(1)
            writer.setsampwidth(2)
            writer.setframerate(16000)
            writer.writeframes(binary.tobytes())
        return output.getvalue()

    generator = random.Random(541)
    noisy = make_wav(max(-32768, min(32767, value + generator.randrange(-10000, 10001))) for value in samples)
    # The insertion point is the actual aligned boundary obtained on the first
    # reference smoke, not a production/scenario-specific scoring condition.
    fixture_cases = [(name, (arguments.fixtures / name).read_bytes())
                     for name in ("reference.wav", "truncated.wav", "wrong-phrase.wav")]
    fixture_cases.extend([("synthetic-noisy-reference", noisy),
                          ("synthetic-silence", make_wav([0] * 16000))])
    for file_name, data in fixture_cases:
        encoded = base64.b64encode(data).decode("ascii")
        start = time.monotonic()
        result = PhoneticEngine().evaluate({"language": "en", "locale": "en-US",
            "expectedText": "She works every day.", "audioBase64": encoded, "learnerLevel": "A1"})
        elapsed = round((time.monotonic() - start) * 1000, 3)
        assert result["masteryEligible"] is False
        assert all(result[key] is None for key in ("overallAcousticScore", "accuracyScore",
            "completenessScore", "fluencyScore", "prosodyScore", "confidence"))
        assert all(phone["observed"] is None and phone["bestAlternative"] is None
                   and phone["confidence"] is None for phone in result["phonemes"])
        cases.append({"fixture": file_name, "synthetic": True,
            "status": result["status"], "errors": result["errors"],
            "capability": result["capability"], "calibrationStatus": result["calibrationStatus"],
            "masteryEligible": result["masteryEligible"], "wordCount": len(result["words"]),
            "phonemeCount": len(result["phonemes"]), "pedagogicalScoresAllNull": True,
            "observedPhonemesNotInvented": True, "elapsedMs": elapsed,
            "evidence": result["evidence"], "peakProcessMemoryBytes": peak_memory_bytes()})
        if file_name == "reference.wav" and len(result["words"]) >= 3:
            at = round(result["words"][1]["endMs"] * 16)
            paused = make_wav(list(samples[:at]) + [0] * 32000 + list(samples[at:]))
            fixture_cases.append(("synthetic-internal-pause", paused))
    print(json.dumps({"validation": "OFFLINE_SYNTHETIC_MODEL_SMOKE_NOT_HUMAN_CALIBRATION",
        "cases": cases, "sampleCount": len(cases),
        "medianElapsedMs": statistics.median(case["elapsedMs"] for case in cases),
        "p95": "NOT_REPRESENTATIVE_INSUFFICIENT_SAMPLE", "paidCalls": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
