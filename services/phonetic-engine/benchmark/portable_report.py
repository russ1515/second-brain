"""Pure portable benchmark reporting: no model, network, audio or provider calls.

Only measured observations are summarized. Three successful repetitions do not
turn five controlled alterations into fifteen independent gold cases. Candidate
contrast evidence is never promoted to a calibrated diagnosis or mastery score.
"""

from __future__ import annotations

from copy import deepcopy
import math
import statistics


MAX_REPETITIONS = 3
TIMING_KEYS = ("preprocessingElapsedMs", "warmInferenceElapsedMs",
               "alignmentElapsedMs", "scorerTotalElapsedMs", "totalElapsedMs",
               "cpuTimeMs", "harnessElapsedMs", "harnessCpuTimeMs")
COUNT_KEYS = ("correctPrimaryRawCandidateLocalizations",
              "correctPrimaryCandidateLocalizations", "correctPrimaryReliableLocalizations",
              "referenceRawCandidateFalsePositives", "referenceCandidateFalsePositives",
              "referenceConfirmedFalsePositives", "referenceUnexpectedObservedSubstitutions",
              "diagnosticAbstentions", "phonemeCount", "phonemeAbstentions",
              "casesWithoutCandidateRegions", "observedReferenceCount", "measuredCases",
              "measuredControlledAlterations")


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def observed_summary(values):
    """No zero, confidence interval or p95 is fabricated for an absent sample."""
    if any(not _number(value) or value < 0 for value in values):
        raise ValueError("PORTABLE_REPORT_INVALID_NUMERIC_OBSERVATION")
    return {"status": "MEASURED" if values else "NOT_MEASURED", "sampleCount": len(values),
            "min": min(values) if values else None,
            "medianObserved": statistics.median(values) if values else None,
            "max": max(values) if values else None}


def _timing_values(rows, key):
    values = []
    for row in rows:
        timings = row.get("timingsMs", {})
        if key in timings and timings[key] is not None:
            values.append(timings[key])
    return values


def _timings(rows):
    measured = [row for row in rows if row.get("state") == "MEASURED"]
    result = {key: observed_summary(_timing_values(measured, key)) for key in TIMING_KEYS}
    residuals = []
    for row in measured:
        timings = row.get("timingsMs", {})
        total, ctc = timings.get("scorerTotalElapsedMs"), timings.get("alignmentElapsedMs")
        if _number(total) and _number(ctc) and total >= ctc >= 0:
            residuals.append(total - ctc)
    result["gopEvidenceAndScorerOverheadElapsedMs"] = {
        **observed_summary(residuals),
        "definition": "scorerTotalElapsedMs minus alignmentElapsedMs; includes mapper validation, "
                      "GOP-like evidence, word/diagnostic aggregation and scorer overhead; NOT pure GOP"}
    result["nativeModelInferenceOnly"] = {"status": "NOT_SEPARATELY_MEASURED",
                                            "sampleCount": 0, "min": None,
                                            "medianObserved": None, "max": None}
    result["sessionAndPosteriorElapsedMs"] = {
        "sourceKey": "warmInferenceElapsedMs",
        "includes": "session.run plus output validation and log-posterior conversion",
        "all": observed_summary(_timing_values(measured, "warmInferenceElapsedMs")),
        "firstInference": observed_summary(_timing_values([
            row for row in measured if row.get("timingsMs", {}).get("inferenceWasWarm") is False],
            "warmInferenceElapsedMs")),
        "warmInference": observed_summary(_timing_values([
            row for row in measured if row.get("timingsMs", {}).get("inferenceWasWarm") is True],
            "warmInferenceElapsedMs")),
        "unknownWarmState": observed_summary(_timing_values([
            row for row in measured if not isinstance(row.get("timingsMs", {}).get("inferenceWasWarm"), bool)],
            "warmInferenceElapsedMs"))}
    result["p95"] = "NOT_REPRESENTATIVE"
    return result


def _localization(rows, key):
    answers = [row[key] for row in rows if row.get("state") == "MEASURED" and key in row]
    if any(answer not in ("YES", "NO", "NOT_APPLICABLE") for answer in answers):
        raise ValueError("PORTABLE_REPORT_INVALID_LOCALIZATION")
    applicable = [answer for answer in answers if answer != "NOT_APPLICABLE"]
    return {"status": "MEASURED" if applicable else "NOT_RUN" if not answers else "NOT_APPLICABLE",
            "measuredRepetitions": len(applicable), "localizedRepetitions": applicable.count("YES"),
            "perRepetition": answers, "repeatedObservationsNotIndependentGoldCases": True}


def _phase_summary(phase):
    # Preserve actual child metrics; never call the report process RSS model RAM.
    samples = phase.get("resourceSamples", [])
    memory = {key: observed_summary([sample["child"][key] for sample in samples
                                    if isinstance(sample.get("child"), dict)
                                    and key in sample["child"]])
              for key in ("workingSetBytes", "peakWorkingSetBytes", "privateCommitBytes",
                          "peakPrivateCommitBytes")}
    return {"phase": phase.get("phase", "UNKNOWN"), "status": phase.get("status", "NOT_RUN"),
            "modelLoad": phase.get("modelLoad", "NOT_RUN"),
            "loadMetrics": deepcopy(phase.get("loadMetrics")), "memory": memory,
            "memoryAtStagePermissions": {stage: deepcopy(next(sample for sample in samples
                if sample.get("stage") == stage)) for stage in
                ("before_runtime_import", "before_native_import", "before_session_load", "after_session_load")
                if any(sample.get("stage") == stage for sample in samples)},
            "systemBaselineSamples": deepcopy(phase.get("baseline", [])),
            "systemAfterExit": deepcopy(phase.get("systemAfterExit")),
            "jobProof": deepcopy(phase.get("jobProof")),
            "memoryPeakMayBeTruncated": phase.get("status") != "PASS",
            "release": deepcopy(phase.get("release")),
            "error": phase.get("error"), "measurementsCompleted": phase.get("measurementsCompleted", 0)}


def build_report(onnx_phase_results, comparisons, baseline_report=None, environment=None, *,
                 status="NOT_RUN", error=None):
    """Aggregate up to three comparison_report outputs without any inference.

    `comparisons` includes partial/error runs too: never omit a failed repetition
    to make the experiment look successful. Each successful comparison must be
    from the same frozen inventory. `environment` must be sanitized by caller.
    """
    if status not in ("NOT_RUN", "PASS", "PARTIAL_PASS", "FAIL", "BLOCKED_CAPABILITY"):
        raise ValueError("PORTABLE_REPORT_STATUS_INVALID")
    if not isinstance(comparisons, list) or len(comparisons) > MAX_REPETITIONS:
        raise ValueError("PORTABLE_REPORT_REPETITION_LIMIT")
    if not isinstance(onnx_phase_results, list):
        raise ValueError("PORTABLE_REPORT_PHASE_RESULTS_INVALID")
    if any(phase.get("paidCalls", 0) != 0 or phase.get("costUsd", 0) != 0
           for phase in onnx_phase_results):
        raise ValueError("PORTABLE_REPORT_LOCAL_ONLY_BOUNDARY")
    for comparison in comparisons:
        if (comparison.get("masteryEligible") is not False
                or comparison.get("calibrationStatus") != "UNCALIBRATED"
                or comparison.get("paidCalls", 0) != 0):
            raise ValueError("PORTABLE_REPORT_UNCALIBRATED_BOUNDARY")
    historical = deepcopy(baseline_report)
    if historical is None and comparisons:
        historical = deepcopy(comparisons[0].get("baseline"))
    expected_denominator = historical.get("controlledAlterations") if historical else None
    canonical_cases = {}
    by_case = {}
    expected_case_ids = None
    successful = 0
    all_measured = []
    for repetition, comparison in enumerate(comparisons, 1):
        v2 = comparison.get("v2", {})
        denominator = v2.get("controlledAlterations")
        if expected_denominator is None:
            expected_denominator = denominator
        if denominator != expected_denominator:
            raise ValueError("PORTABLE_REPORT_GOLD_DENOMINATOR_CHANGED")
        if historical is not None and comparison.get("baseline") != historical:
            raise ValueError("PORTABLE_REPORT_BASELINE_CHANGED")
        rows = comparison.get("cases", [])
        seen = set()
        for row in rows:
            case_id = row.get("id")
            if not isinstance(case_id, str) or case_id in seen:
                raise ValueError("PORTABLE_REPORT_CASE_ID_INVALID")
            seen.add(case_id)
            if row.get("state") not in ("MEASURED", "TECHNICAL_ERROR", "NOT_RUN"):
                raise ValueError("PORTABLE_REPORT_CASE_STATE_INVALID")
            measured = row.get("state") == "MEASURED"
            if measured:
                signature = {key: deepcopy(row.get(key)) for key in
                             ("category", "fixtureSha256", "goldRegions", "caveats")}
                if case_id in canonical_cases and canonical_cases[case_id] != signature:
                    raise ValueError("PORTABLE_REPORT_FROZEN_CASE_CHANGED")
                canonical_cases[case_id] = signature
                all_measured.append(row)
            by_case.setdefault(case_id, []).append({"repetition": repetition, **deepcopy(row)})
        if expected_case_ids is None:
            expected_case_ids = seen
        elif expected_case_ids != seen:
            raise ValueError("PORTABLE_REPORT_CASE_SET_CHANGED")
        if (rows and all(row.get("state") == "MEASURED" for row in rows)
                and v2.get("measuredControlledAlterations") == expected_denominator
                and v2.get("measuredCases") == len(rows)):
            successful += 1
    if status == "PASS" and (len(comparisons) != MAX_REPETITIONS or successful != MAX_REPETITIONS):
        raise ValueError("PORTABLE_REPORT_PASS_REQUIRES_THREE_COMPLETE_REPETITIONS")
    if not comparisons and status in ("PASS", "PARTIAL_PASS"):
        raise ValueError("PORTABLE_REPORT_NO_MEASUREMENTS")
    counts = {}
    for key in COUNT_KEYS:
        values = [comparison["v2"][key] for comparison in comparisons
                  if key in comparison.get("v2", {}) and comparison["v2"].get("measuredCases", 0) > 0]
        counts[key] = {**observed_summary(values), "perRepetition": values,
                       "notSummedAcrossRepetitions": True}
    case_reports = []
    for case_id, rows in by_case.items():
        reasons = {}
        for row in rows:
            for reason, count in row.get("phonemeAbstentionReasons", {}).items():
                if not isinstance(count, int) or isinstance(count, bool) or count < 0:
                    raise ValueError("PORTABLE_REPORT_INVALID_ABSTENTION_COUNT")
                reasons.setdefault(reason, []).append(count)
        case_reports.append({"id": case_id, **canonical_cases.get(case_id, {}),
            "state": "MEASURED" if any(row.get("state") == "MEASURED" for row in rows) else
                     "TECHNICAL_ERROR" if any(row.get("state") == "TECHNICAL_ERROR" for row in rows) else "NOT_RUN",
            "primaryRawCandidateLocalization": _localization(rows, "primaryRawCandidateLocalization"),
            "primaryFilteredCandidateLocalization": _localization(rows, "primaryCandidateLocalization"),
            "primaryReliableLocalization": _localization(rows, "primaryReliableLocalization"),
            "timingsMs": _timings(rows),
            "phonemeAbstentionReasons": {reason: {**observed_summary(values), "perObservedRepetition": values}
                                        for reason, values in reasons.items()},
            # Keep source-indexed regions/FP/abstentions/error states unmodified.
            "repetitions": rows})
    phases = [_phase_summary(phase) for phase in onnx_phase_results]
    load_times = [phase["loadMetrics"]["modelLoadElapsedMs"] for phase in phases
                  if isinstance(phase.get("loadMetrics"), dict)
                  and "modelLoadElapsedMs" in phase["loadMetrics"] and phase["modelLoad"] == "PASS"]
    return {"reportVersion": "phonetic-v2-portable-report-v1", "status": status, "error": error,
            "environment": deepcopy(environment or {}), "experimentalOnly": True,
            "repetitions": {"requested": MAX_REPETITIONS, "observed": len(comparisons),
                            "complete": successful},
            "controlledGoldCases": expected_denominator,
            "baseline": historical, "countsAcrossRepetitions": counts,
            "cases": case_reports, "timingsMs": _timings(all_measured),
            "modelLoadElapsedMs": observed_summary(load_times), "phases": phases,
            "quality": {"status": "NOT_VERIFIED", "diagnosisUsefulness": "NOT_VERIFIED",
                        "int8QualityLossVsFp32": "NOT_MEASURED",
                        "reliabilityRequiresIndependentHumanCalibration": True,
                        "candidateLocalizationNotReliableDiagnosis": True,
                        "classificationPolicy": "REPORT_RAW_FILTERED_RELIABLE_AND_ERRORS_SEPARATELY; "
                                                "NO_NEW_CALIBRATED_PASS_THRESHOLD"},
            "paidCalls": 0, "costUsd": 0, "masteryEligible": False,
            "calibrationStatus": "UNCALIBRATED", "vpsTouched": False,
            "betaDeployed": False, "migrations": 0}
