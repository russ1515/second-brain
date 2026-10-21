"""Immutable-fixture V2 evaluation, not human calibration or product scoring.

The saved Phase H observations are the A baseline. Inventory never loads a
model. No network access, provider calls, production rules or learner audio are
used. Expected altered regions belong only to these technical test fixtures.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import statistics
import sys
import time
from typing import Any
import wave


INVENTORY_VERSION = "phonetic-v2-controlled-inventory-v1"
PRIMARY_GOLD_POLICY = (
    "Exact expected-sequence phone index AND word index; word-only warnings, "
    "raw low scores and a matching alternative without an asserted weak region "
    "do not count as localized. Report additional unrelated warnings separately."
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def summary(values: list[float]) -> dict[str, Any] | None:
    if not values:
        return None
    return {"sampleCount": len(values), "min": min(values),
            "medianObserved": statistics.median(values), "max": max(values)}


def _gold_regions(row: dict[str, Any], phones: list[dict[str, Any]]) -> list[dict[str, Any]]:
    intended = row.get("expectedManipulatedRegion") or {}
    word_index = intended.get("wordIndex")
    arpabet = intended.get("expectedArpabet")
    if not isinstance(word_index, int) or not isinstance(arpabet, str):
        return []
    selected = [phone for phone in phones if phone.get("wordIndex") == word_index
                and phone.get("expectedArpabet") == arpabet]
    if len(selected) != 1:
        raise ValueError("CONTROLLED_PRIMARY_PHONE_NOT_UNIQUE:" + row["id"])
    primary = selected[0]
    regions = [{"role": "PRIMARY", "wordIndex": word_index,
                "expectedPhoneIndex": primary["index"],
                "expectedArpabet": arpabet, "expectedCanonicalPhone": primary["expectedPhoneme"],
                "intendedAlternativeArpabet": intended.get("intentionalAlternative"),
                "temporalGroundTruth": "NOT_HUMAN_LABELLED"}]
    # A manifest describes every known manipulation, not only the easiest one.
    # This is test metadata from the frozen Phase H report, never scorer logic.
    secondary = intended.get("alsoFinal")
    if isinstance(secondary, str) and "_TO_" in secondary:
        expected, alternative = secondary.split("_TO_", 1)
        selected = [phone for phone in phones if phone.get("wordIndex") == word_index
                    and phone.get("expectedArpabet") == expected]
        if not selected:
            raise ValueError("CONTROLLED_SECONDARY_PHONE_MISSING:" + row["id"])
        phone = selected[-1]
        regions.append({"role": "SECONDARY", "wordIndex": word_index,
                        "expectedPhoneIndex": phone["index"],
                        "expectedArpabet": expected,
                        "expectedCanonicalPhone": phone["expectedPhoneme"],
                        "intendedAlternativeArpabet": alternative,
                        "temporalGroundTruth": "NOT_HUMAN_LABELLED"})
    return regions


def fixture_inventory(baseline_path: Path, fixtures_dir: Path) -> dict[str, Any]:
    """Freeze hashes and intended regions BEFORE seeing new model results.

    Source audio and its baseline must match exactly. Existing alignment times
    are not promoted to human phoneme-boundary ground truth.
    """
    baseline = read_json(baseline_path)
    rows = baseline.get("cases")
    if not isinstance(rows, list) or not rows:
        raise ValueError("CONTROLLED_BASELINE_EMPTY")
    cases = []
    seen: set[str] = set()
    for row in rows:
        case_id = row.get("id")
        if not isinstance(case_id, str) or not case_id or Path(case_id).name != case_id or case_id in seen:
            raise ValueError("CONTROLLED_CASE_ID_INVALID")
        seen.add(case_id)
        audio_path = fixtures_dir / (case_id + ".wav")
        digest = sha256(audio_path)
        if digest != row.get("fixtureSha256"):
            raise ValueError("CONTROLLED_FIXTURE_HASH_MISMATCH:" + case_id)
        with wave.open(str(audio_path), "rb") as audio:
            metadata = {"channels": audio.getnchannels(), "sampleRate": audio.getframerate(),
                        "sampleWidthBytes": audio.getsampwidth(), "frames": audio.getnframes(),
                        "durationMs": audio.getnframes() / audio.getframerate() * 1000}
        if (metadata["channels"], metadata["sampleRate"], metadata["sampleWidthBytes"]) != (1, 16000, 2):
            raise ValueError("CONTROLLED_FIXTURE_PCM_UNSUPPORTED:" + case_id)
        source = row
        phones = row.get("result", {}).get("phonemes", [])
        if not phones:
            source = next((candidate for candidate in rows
                           if candidate.get("category") == "REFERENCE"
                           and candidate.get("expectedText") == row.get("expectedText")
                           and candidate.get("result", {}).get("phonemes")), row)
            phones = source.get("result", {}).get("phonemes", [])
        regions = _gold_regions(row, phones)
        caveats = ["SYNTHETIC_AUDIO_NOT_HUMAN_CALIBRATION", "NO_HUMAN_PHONE_BOUNDARY_LABELS"]
        intended = row.get("expectedManipulatedRegion") or {}
        if intended.get("syntheticLexicalRenderingUnverified"):
            caveats.append("INTENDED_SUBSTITUTION_NOT_INDEPENDENTLY_LISTENED")
        if intended.get("alsoFinal"):
            caveats.append("MULTIPLE_PHONEME_AND_LEXICAL_CHANGES_NOT_ISOLATED")
        cases.append({"id": case_id, "category": row["category"],
                      "expectedText": row["expectedText"], "syntheticText": row.get("syntheticText"),
                      "audioPath": str(audio_path.resolve()), "fixtureSha256": digest,
                      "audio": metadata, "intendedManipulation": intended,
                      "goldRegions": regions, "expectedSequenceSourceCase": source["id"],
                      "expectedSequence": [{"index": phone["index"], "wordIndex": phone["wordIndex"],
                                            "canonicalPhone": phone["expectedPhoneme"],
                                            "arpabet": phone["expectedArpabet"]} for phone in phones],
                      "caveats": caveats})
    controlled = [case for case in cases if case["goldRegions"]]
    return {"version": INVENTORY_VERSION,
            "scope": "CONTROLLED_SYNTHETIC_NOT_HUMAN_CALIBRATION",
            "baselineSha256": sha256(baseline_path), "baselinePath": str(baseline_path.resolve()),
            "primaryGoldPolicy": PRIMARY_GOLD_POLICY,
            "controlledAlterationCount": len(controlled),
            "referenceCount": sum(case["category"] == "REFERENCE" for case in cases),
            "caseCount": len(cases), "cases": cases,
            "paidCalls": 0, "calibrationStatus": "UNCALIBRATED", "masteryEligible": False}


def write_json_exclusive(path: Path, data: Any) -> None:
    """Do not silently replace a frozen manifest or a previous measurement."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)
        output.write("\n")


def _diagnostic(result: dict[str, Any]) -> dict[str, Any]:
    return result.get("diagnostic") or result.get("evidence", {}).get("pronunciationDiagnostic", {})


def _regions(result: dict[str, Any], key: str) -> list[dict[str, Any]]:
    """Normalize asserted indexed regions, never rank raw scores as errors."""
    diagnostic = _diagnostic(result)
    regions = result.get(key, diagnostic.get(key, []))
    if key == "confirmedWeakPhonemes" and not regions:
        regions = diagnostic.get("highConfidenceIssues", [])
    phones = {phone["index"]: phone for phone in result.get("phonemes", [])
              if isinstance(phone, dict) and isinstance(phone.get("index"), int)}
    normalized = []
    seen = set()
    for region in regions:
        index = region if isinstance(region, int) else region.get("phonemeIndex", region.get("index")) if isinstance(region, dict) else None
        if not isinstance(index, int) or index not in phones:
            raise ValueError("V2_DIAGNOSTIC_REGION_INDEX_INVALID")
        if index in seen:
            continue
        seen.add(index)
        phone = phones[index]
        if not isinstance(phone.get("wordIndex"), int):
            raise ValueError("V2_DIAGNOSTIC_WORD_INDEX_MISSING")
        if isinstance(region, dict) and region.get("wordIndex", phone["wordIndex"]) != phone["wordIndex"]:
            raise ValueError("V2_DIAGNOSTIC_WORD_INDEX_INCONSISTENT")
        normalized.append({"expectedPhoneIndex": index, "wordIndex": phone["wordIndex"],
                           "expectedPhoneme": phone.get("expectedPhoneme"),
                           "canonicalId": phone.get("canonicalId"),
                           "rawScore": phone.get("rawScore"),
                           "marginToAlternative": phone.get("marginToAlternative"),
                           "confidence": phone.get("confidence"),
                           "observedPhoneme": phone.get("observedPhoneme", phone.get("observed")),
                           "startFrame": phone.get("startFrame"), "endFrame": phone.get("endFrame"),
                           "startMs": phone.get("startMs"), "endMs": phone.get("endMs")})
    return normalized


def evaluate_case(case: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    if result.get("masteryEligible") is not False or result.get("calibrationStatus") != "UNCALIBRATED":
        raise ValueError("V2_UNCALIBRATED_BOUNDARY_VIOLATED")
    candidates = _regions(result, "weakRegionCandidates")
    confirmed = _regions(result, "confirmedWeakPhonemes")
    raw_indices = [phone["index"] for phone in result.get("phonemes", [])
                   if phone.get("rawWeakRegionCandidate") is True]
    raw_candidates = _regions({**result, "rawWeakRegionCandidates": raw_indices}, "rawWeakRegionCandidates")
    gold = case["goldRegions"]
    target_regions = {(region["wordIndex"], region["expectedPhoneIndex"]) for region in gold}
    primary = next((region for region in gold if region["role"] == "PRIMARY"), None)
    primary_region = (primary["wordIndex"], primary["expectedPhoneIndex"]) if primary else None
    candidate_locations = {(region["wordIndex"], region["expectedPhoneIndex"]) for region in candidates}
    confirmed_locations = {(region["wordIndex"], region["expectedPhoneIndex"]) for region in confirmed}
    raw_locations = {(region["wordIndex"], region["expectedPhoneIndex"]) for region in raw_candidates}
    diagnostic = _diagnostic(result)
    status = result.get("diagnosticStatus", diagnostic.get("status", "NOT_REPORTED"))
    claims = [phone for phone in result.get("phonemes", [])
              if phone.get("observedPhoneme", phone.get("observed")) is not None]
    unexpected_claims = [phone for phone in claims
                         if phone.get("observedPhoneme", phone.get("observed")) != phone.get("expectedPhoneme")]
    abstention_reasons: dict[str, int] = {}
    for phone in result.get("phonemes", []):
        reason = phone.get("abstentionReason")
        if isinstance(reason, str) and reason:
            abstention_reasons[reason] = abstention_reasons.get(reason, 0) + 1
    return {"id": case["id"], "category": case["category"],
            "fixtureSha256": case["fixtureSha256"], "goldRegions": gold,
            "candidateRegions": candidates, "confirmedRegions": confirmed,
            "rawCandidateRegions": raw_candidates,
            "primaryRawCandidateLocalization": "YES" if primary_region in raw_locations else "NO" if primary else "NOT_APPLICABLE",
            "primaryCandidateLocalization": "YES" if primary_region in candidate_locations else "NO" if primary else "NOT_APPLICABLE",
            "primaryReliableLocalization": "YES" if primary_region in confirmed_locations else "NO" if primary else "NOT_APPLICABLE",
            "perRegion": [{**region,
                           "candidateLocalized": (region["wordIndex"], region["expectedPhoneIndex"]) in candidate_locations,
                           "rawCandidateLocalized": (region["wordIndex"], region["expectedPhoneIndex"]) in raw_locations,
                           "reliablyLocalized": (region["wordIndex"], region["expectedPhoneIndex"]) in confirmed_locations}
                          for region in gold],
            "unrelatedCandidateRegions": [region for region in candidates
                                           if (region["wordIndex"], region["expectedPhoneIndex"]) not in target_regions],
            "cleanReferenceCandidateFalsePositives": len(candidates) if case["category"] == "REFERENCE" else None,
            "cleanReferenceRawCandidateFalsePositives": len(raw_candidates) if case["category"] == "REFERENCE" else None,
            "cleanReferenceConfirmedFalsePositives": len(confirmed) if case["category"] == "REFERENCE" else None,
            "cleanReferenceUnexpectedObservedSubstitutions": len(unexpected_claims) if case["category"] == "REFERENCE" else None,
            "diagnosticStatus": status, "confidence": result.get("confidence"),
            "diagnosticAbstention": result.get("confidence") is None and not confirmed,
            "phonemeCount": len(result.get("phonemes", [])),
            "phonemeAbstentionCount": sum(abstention_reasons.values()),
            "phonemeAbstentionReasons": abstention_reasons,
            "contentStatus": result.get("contentStatus", "NOT_REPORTED"),
            "caveats": case["caveats"]}


def comparison_report(inventory: dict[str, Any], baseline: dict[str, Any], measurements: list[dict[str, Any]]) -> dict[str, Any]:
    frozen = {case["id"]: case for case in inventory["cases"]}
    historical = {row["id"]: row for row in baseline["cases"]}
    v2_by_id = {row["id"]: row for row in measurements}
    if len(v2_by_id) != len(measurements):
        raise ValueError("V2_DUPLICATE_MEASUREMENT_CASE")
    if set(v2_by_id) - set(frozen):
        raise ValueError("V2_UNFROZEN_MEASUREMENT_CASE")
    rows = []
    for case_id, case in frozen.items():
        if case_id not in v2_by_id:
            rows.append({"id": case_id, "category": case["category"], "state": "NOT_RUN"})
            continue
        measurement = v2_by_id[case_id]
        if measurement.get("fixtureSha256") != case["fixtureSha256"]:
            raise ValueError("V2_MEASUREMENT_FIXTURE_HASH_MISMATCH:" + case_id)
        if measurement.get("executionError"):
            rows.append({"id": case_id, "category": case["category"], "state": "TECHNICAL_ERROR",
                         "executionError": measurement["executionError"]})
            continue
        rows.append({"state": "MEASURED", **evaluate_case(case, measurement["result"]),
                     "baseline": evaluate_case(case, historical[case_id]["result"]),
                     "timingsMs": measurement.get("timingsMs", {}),
                     "peakProcessMemoryBytes": measurement.get("peakProcessMemoryBytes"),
                     "preservedObservations": measurement.get("preservedObservations", {})})
    measured = [row for row in rows if row["state"] == "MEASURED"]
    altered = [row for row in measured if row.get("goldRegions")]
    references = [row for row in measured if row["category"] == "REFERENCE"]
    baseline_cases = [evaluate_case(case, historical[case["id"]]["result"]) for case in frozen.values()]
    baseline_altered = [row for row in baseline_cases if row["goldRegions"]]
    baseline_references = [row for row in baseline_cases if row["category"] == "REFERENCE"]
    baseline_summary = {
        "correctPrimaryReliableLocalizations": sum(row["primaryReliableLocalization"] == "YES" for row in baseline_altered),
        "controlledAlterations": inventory["controlledAlterationCount"],
        "referenceConfirmedFalsePositives": sum(row["cleanReferenceConfirmedFalsePositives"] for row in baseline_references),
        "referenceCount": len(baseline_references), "measuredCases": len(baseline_cases),
        "diagnosticAbstentions": sum(row["diagnosticAbstention"] for row in baseline_cases),
        "measurementSource": "SAVED_PHASE_H_SAME_AUDIO_NOT_REINFERRED",
    }
    performance = {}
    for key in ("preprocessingElapsedMs", "warmInferenceElapsedMs", "alignmentElapsedMs", "totalElapsedMs", "cpuTimeMs", "harnessElapsedMs", "harnessCpuTimeMs"):
        values = [row["timingsMs"][key] for row in measured
                  if isinstance(row.get("timingsMs", {}).get(key), (int, float))]
        performance[key] = summary(values)
    warm_values = [row["timingsMs"]["warmInferenceElapsedMs"] for row in measured[1:]
                   if isinstance(row.get("timingsMs", {}).get("warmInferenceElapsedMs"), (int, float))]
    performance["warmInferenceExcludingFirstCallMs"] = summary(warm_values)
    memory = [row["peakProcessMemoryBytes"] for row in measured if isinstance(row.get("peakProcessMemoryBytes"), int)]
    return {"validation": "FROZEN_SYNTHETIC_A_B_NOT_HUMAN_CALIBRATION",
            "baseline": baseline_summary,
            "v2": {"correctPrimaryCandidateLocalizations": sum(row["primaryCandidateLocalization"] == "YES" for row in altered),
                   "correctPrimaryRawCandidateLocalizations": sum(row["primaryRawCandidateLocalization"] == "YES" for row in altered),
                   "correctPrimaryReliableLocalizations": sum(row["primaryReliableLocalization"] == "YES" for row in altered),
                   "controlledAlterations": inventory["controlledAlterationCount"],
                   "measuredControlledAlterations": len(altered),
                   "referenceCandidateFalsePositives": sum(row["cleanReferenceCandidateFalsePositives"] for row in references),
                   "referenceRawCandidateFalsePositives": sum(row["cleanReferenceRawCandidateFalsePositives"] for row in references),
                   "referenceConfirmedFalsePositives": sum(row["cleanReferenceConfirmedFalsePositives"] for row in references),
                   "referenceUnexpectedObservedSubstitutions": sum(row["cleanReferenceUnexpectedObservedSubstitutions"] for row in references),
                   "diagnosticAbstentions": sum(row["diagnosticAbstention"] for row in measured),
                   "phonemeCount": sum(row["phonemeCount"] for row in measured),
                   "phonemeAbstentions": sum(row["phonemeAbstentionCount"] for row in measured),
                   "casesWithoutCandidateRegions": sum(not row["candidateRegions"] for row in measured),
                   "observedReferenceCount": len(references), "measuredCases": len(measured)},
            "interpretation": {"candidateNotCertifiedDiagnosis": True,
                               "negativeMarginNotMasteryOrCalibratedError": True,
                               "historicalVsCurrentPerformanceNotRandomized": True,
                               "materialImprovementDecision": "EVIDENCE_REVIEW_REQUIRED_NO_ARBITRARY_PASS_THRESHOLD",
                               "p95": "NOT_REPRESENTATIVE"},
            "timingsMs": performance,
            "baselineTimingsMs": baseline.get("timingsMs"),
            "peakProcessMemoryBytes": max(memory) if memory else None,
            "baselinePeakProcessMemoryBytes": baseline.get("peakProcessMemoryBytes"),
            "cases": rows, "paidCalls": 0, "masteryEligible": False,
            "calibrationStatus": "UNCALIBRATED", "prosody": "NOT_IMPLEMENTED"}


def execute_runtime(inventory: dict[str, Any], baseline: dict[str, Any], runtime: Any,
                    output: Path) -> dict[str, Any]:
    """The caller provides an already licensed/local-only runtime implementation.

    No fixture category, altered region or synthetic spoken text reaches it.
    Only existing same-hash completeness/fluency observations can be carried.
    """
    if output.exists():
        raise FileExistsError(output)
    case_directory = output.parent / (output.stem + "-cases")
    if case_directory.exists():
        raise FileExistsError(case_directory)
    case_directory.mkdir(parents=True)
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from run_local_acceptance import peak_memory_bytes
    load_started = time.monotonic()
    load_cpu = time.process_time()
    try:
        load_metrics = runtime.load()
    except Exception as error:
        # Preserve a blocked initialization without running/retrying a single
        # fixture. Only a bounded stable code is retained, never arbitrary logs.
        label = str(error).split(":", 1)[0]
        code = label if label and len(label) <= 80 and all(character.isupper() or character.isdigit() or character == "_" for character in label) else type(error).__name__
        blocked = {"status": "NOT_LOADED", "errorCode": code,
                   "loadElapsedMs": (time.monotonic() - load_started) * 1000,
                   "loadCpuTimeMs": (time.process_time() - load_cpu) * 1000,
                   "peakProcessMemoryBytes": peak_memory_bytes()}
        resource = getattr(error, "resource", None)
        if isinstance(resource, dict):
            blocked["resource"] = {key: resource.get(key) if isinstance(resource.get(key), int)
                and not isinstance(resource.get(key), bool) and 0 <= resource[key] <= 10**15 else None
                for key in ("availableMemoryBytes", "requiredHeadroomBytes")}
        write_json_exclusive(case_directory / "model-load.json", blocked)
        report = comparison_report(inventory, baseline, [])
        report["modelLoad"] = blocked
        report["modelLoadedOnce"] = False
        report["runtimeBlocked"] = code
        write_json_exclusive(output, report)
        return report
    measured_load = {"loadElapsedMs": (time.monotonic() - load_started) * 1000,
                     "loadCpuTimeMs": (time.process_time() - load_cpu) * 1000,
                     "peakProcessMemoryBytes": peak_memory_bytes(),
                     "runtimeMetrics": load_metrics}
    write_json_exclusive(case_directory / "model-load.json", measured_load)
    historical = {row["id"]: row for row in baseline["cases"]}
    measurements = []
    for index, case in enumerate(inventory["cases"]):
        audio_path = Path(case["audioPath"])
        if sha256(audio_path) != case["fixtureSha256"]:
            raise ValueError("CONTROLLED_FIXTURE_CHANGED_BEFORE_INFERENCE:" + case["id"])
        if case["audio"]["durationMs"] > 30000:
            raise ValueError("CONTROLLED_FIXTURE_DURATION_EXCEEDS_BOUND")
        baseline_row = historical[case["id"]]
        if baseline_row["fixtureSha256"] != case["fixtureSha256"] or baseline_row["expectedText"] != case["expectedText"]:
            raise ValueError("BASELINE_CARRIED_EVIDENCE_SOURCE_MISMATCH")
        evidence = baseline_row["result"].get("evidence", {})
        completeness = evidence.get("completeness")
        fluency = evidence.get("fluency")
        started = time.monotonic()
        cpu = time.process_time()
        measured = {"id": case["id"], "fixtureSha256": case["fixtureSha256"],
                    "preservedObservations": {
                        "completeness": "CARRIED_FORWARD_SAME_AUDIO_SHA" if completeness else "NOT_AVAILABLE",
                        "fluency": "CARRIED_FORWARD_SAME_AUDIO_SHA" if fluency else "NOT_AVAILABLE",
                        "notNewScorerProof": True}}
        try:
            result = runtime.assess(audio_path.read_bytes(), case["expectedText"], locale="en-US",
                                    baseline_completeness=completeness, baseline_fluency=fluency)
            measured["result"] = result
            measured["timingsMs"] = {**result.get("timings", {}),
                                     "harnessElapsedMs": (time.monotonic() - started) * 1000,
                                     "harnessCpuTimeMs": (time.process_time() - cpu) * 1000}
            measured["peakProcessMemoryBytes"] = peak_memory_bytes()
            # Structural safety is checked per case before accepting a result.
            evaluate_case(case, result)
        except MemoryError:
            raise
        except Exception as error:
            measured["executionError"] = type(error).__name__
            measured.pop("result", None)
        measurements.append(measured)
        write_json_exclusive(case_directory / (f"{index:03d}-" + case["id"] + ".json"), measured)
    report = comparison_report(inventory, baseline, measurements)
    report["modelLoad"] = measured_load
    report["modelLoadedOnce"] = True
    report["rawMeasurements"] = measurements
    write_json_exclusive(output, report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--fixtures", required=True, type=Path)
    parser.add_argument("--inventory-output", required=True, type=Path)
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--dictionary", type=Path)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    inventory = fixture_inventory(arguments.baseline, arguments.fixtures)
    if arguments.inventory_output.exists():
        existing = read_json(arguments.inventory_output)
        if existing != inventory:
            raise ValueError("FROZEN_INVENTORY_CHANGED")
    else:
        write_json_exclusive(arguments.inventory_output, inventory)
    if arguments.model_dir or arguments.dictionary or arguments.output:
        if not (arguments.model_dir and arguments.dictionary and arguments.output):
            parser.error("--model-dir, --dictionary and --output are required together")
        # This branch is used only after the root operator verifies local
        # weights/licenses. No download or dependency installation exists here.
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from v2.runtime import LocalWav2Vec2Runtime
        runtime = LocalWav2Vec2Runtime(arguments.model_dir, arguments.dictionary, threads=1)
        report = execute_runtime(inventory, read_json(arguments.baseline), runtime, arguments.output)
        print(json.dumps({"output": str(arguments.output), "baseline": report["baseline"],
                          "v2": report["v2"], "timingsMs": report["timingsMs"], "paidCalls": 0}))
        return
    print(json.dumps({"inventory": str(arguments.inventory_output), "cases": inventory["caseCount"],
                      "controlledAlterations": inventory["controlledAlterationCount"],
                      "references": inventory["referenceCount"], "modelLoaded": False, "paidCalls": 0}))


if __name__ == "__main__":
    main()
