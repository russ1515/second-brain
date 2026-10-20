"""Controlled offline acoustic validation. Synthetic references are NOT calibration.

The supplied directory must contain the locally generated, authorized technical
fixtures. Test-only contrasts never become pronunciation scoring rules.
No provider calls, user recordings, model downloads or audio uploads occur.
"""

import argparse
import array
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
import random
import statistics
import subprocess
import sys
import time
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phonetic_engine import PhoneticEngine
from run_local_acceptance import peak_memory_bytes


def wav_samples(binary):
    with wave.open(io.BytesIO(binary), "rb") as source:
        assert source.getframerate() == 16000 and source.getnchannels() == 1
        assert source.getsampwidth() == 2
        samples = array.array("h", source.readframes(source.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def encode_wav(samples):
    values = array.array("h", samples)
    if sys.byteorder != "little":
        values.byteswap()
    output = io.BytesIO()
    with wave.open(output, "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(16000)
        destination.writeframes(values.tobytes())
    return output.getvalue()


def evaluate(binary, target):
    result = PhoneticEngine().evaluate({
        "targetLanguage": "en", "locale": "en-US", "expectedText": target,
        "audioBase64": base64.b64encode(binary).decode("ascii"), "learnerLevel": "A1",
    })
    assert result["masteryEligible"] is False
    assert result["calibrationStatus"] == "UNCALIBRATED"
    assert result["confidence"] is None and result["overallAcousticScore"] is None
    assert all(phone["observed"] is None and phone["bestAlternative"] is None
               and phone["confidence"] is None for phone in result["phonemes"])
    return result


def worker(payload):
    start = time.monotonic()
    result = evaluate(Path(payload["audioPath"]).read_bytes(), payload["expectedText"])
    return {"result": result, "elapsedMs": (time.monotonic() - start) * 1000,
            "peakMemoryBytes": peak_memory_bytes()}


def isolated_job(audio_path, expected):
    payload = json.dumps({"audioPath": str(audio_path), "expectedText": expected}).encode()
    completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--worker"],
                               input=payload, capture_output=True, timeout=40, check=True)
    assert completed.stderr == b"", "Unexpected worker stderr"
    return json.loads(completed.stdout)


def summary(values):
    return {"sampleCount": len(values), "min": min(values),
            "medianObserved": statistics.median(values), "max": max(values)} if values else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--worker", action="store_true")
    parser.add_argument("--concurrency", action="store_true")
    arguments = parser.parse_args()
    if arguments.worker:
        # Portable worker protocol, independent of the Windows console codepage.
        print(json.dumps(worker(json.loads(sys.stdin.buffer.read())), ensure_ascii=True))
        return
    cases = [
        ("phrase-reference", "She works every day.", "She works every day.", "REFERENCE", None),
        ("ship-reference", "She sees the ship.", "She sees the ship.", "REFERENCE", None),
        ("ship-altered", "She sees the ship.", "She sees the sheep.", "ALTERED_PHONEME", {"wordIndex": 3, "expectedArpabet": "IH", "intentionalAlternative": "IY"}),
        ("think-reference", "I think this is fine.", "I think this is fine.", "REFERENCE", None),
        ("think-altered", "I think this is fine.", "I sink this is fine.", "ALTERED_PHONEME", {"wordIndex": 1, "expectedArpabet": "TH", "intentionalAlternative": "S"}),
        ("this-reference", "This is the book.", "This is the book.", "REFERENCE", None),
        ("this-altered", "This is the book.", "Dis is the book.", "ALTERED_PHONEME", {"wordIndex": 0, "expectedArpabet": "DH", "intentionalAlternative": "D", "syntheticLexicalRenderingUnverified": True}),
        ("light-reference", "I see the light.", "I see the light.", "REFERENCE", None),
        ("light-altered", "I see the light.", "I see the rice.", "ALTERED_WORD_PHONEMES", {"wordIndex": 3, "expectedArpabet": "L", "intentionalAlternative": "R", "alsoFinal": "T_TO_S"}),
        ("ending-omitted", "She works every day.", "She work every day.", "OMITTED_FINAL_PHONEME", {"wordIndex": 1, "expectedArpabet": "S", "intentionalAlternative": "OMITTED"}),
        ("wrong-phrase", "She works every day.", "Please open the window.", "WRONG_PHRASE", None),
        ("partial-phrase", "She works every day.", "She works.", "PARTIAL_PHRASE", {"omittedWordIndexes": [2, 3]}),
    ]
    results = []
    reference = None
    for name, expected, spoken, category, region in cases:
        audio_path = arguments.fixtures / (name + ".wav")
        binary = audio_path.read_bytes()
        measured = isolated_job(audio_path, expected)
        result = measured["result"]
        if name == "phrase-reference":
            reference = (binary, result)
        results.append({"id": name, "category": category, "expectedText": expected,
                        "syntheticText": spoken, "expectedManipulatedRegion": region,
                        "fixtureSha256": hashlib.sha256(binary).hexdigest(), **measured})
    binary, result = reference
    samples = wav_samples(binary)
    at = round(result["words"][1]["endMs"] * 16)
    paused = encode_wav(list(samples[:at]) + [0] * 32000 + list(samples[at:]))
    generator = random.Random(20261021)
    noise = encode_wav(max(-32768, min(32767, value + generator.randrange(-10000, 10001)))
                       for value in samples)
    generated = [("excessive-pause", paused, "EXCESSIVE_PAUSE", {"startMs": at / 16, "insertedDurationMs": 2000}),
                 ("noisy-reference", noise, "NOISY_RECORDING", {"additiveUniformNoisePeak": 10000}),
                 ("silence", encode_wav([0] * 16000), "SILENCE", None)]
    for name, binary, category, region in generated:
        audio_path = arguments.fixtures / (name + ".wav")
        audio_path.write_bytes(binary)  # Explicitly generated technical audio fixture.
        measured = isolated_job(audio_path, "She works every day.")
        results.append({"id": name, "category": category, "expectedText": "She works every day.",
                        "syntheticText": None, "expectedManipulatedRegion": region,
                        "fixtureSha256": hashlib.sha256(binary).hexdigest(), **measured})
    concurrency = []
    if arguments.concurrency:
        reference_path = arguments.fixtures / "phrase-reference.wav"
        for count in (1, 2, 3):
            start = time.monotonic()
            with ThreadPoolExecutor(max_workers=count) as executor:
                futures = [executor.submit(isolated_job, reference_path, "She works every day.") for _ in range(count)]
                jobs = [future.result() for future in futures]
            elapsed = (time.monotonic() - start) * 1000
            concurrency.append({"jobs": count, "batchElapsedMs": elapsed,
                "jobElapsedMs": [job["elapsedMs"] for job in jobs],
                "aggregateProcessPeakBytesUpperBound": sum(job["peakMemoryBytes"] for job in jobs),
                "aggregateCpuTimeMs": sum(job["result"]["evidence"]["timings"]["cpuTimeMs"] for job in jobs),
                "statuses": [job["result"]["status"] for job in jobs], "failures": sum(job["result"]["status"] != "EVIDENCE_AVAILABLE" for job in jobs),
                "scope": "ISOLATED_LOCAL_PROCESSES_NOT_PRODUCTION_CONCURRENCY"})
    timings = {}
    for key in ("preprocessingElapsedMs", "completenessElapsedMs", "alignmentElapsedMs", "totalElapsedMs", "cpuTimeMs"):
        timings[key] = summary([row["result"]["evidence"]["timings"][key] for row in results
                                if key in row["result"]["evidence"].get("timings", {})])
    report = {"validation": "CONTROLLED_SYNTHETIC_NOT_HUMAN_CALIBRATION", "paidCalls": 0,
              "masteryEligible": False, "p95": "NOT_REPRESENTATIVE", "cases": results,
              "timingsMs": timings, "concurrency": concurrency,
              "peakProcessMemoryBytes": max(row["peakMemoryBytes"] for row in results)}
    arguments.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(arguments.output), "cases": len(results), "timingsMs": timings,
                      "concurrency": concurrency, "paidCalls": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
