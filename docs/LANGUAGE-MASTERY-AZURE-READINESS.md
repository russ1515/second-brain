# Language Mastery — Azure pronunciation assessment readiness

Status: **provider-independent software seam complete; Azure transport and
acoustic capability not activated**.

This note records the bounded preparation for the proposed Azure Speech
Pronunciation Assessment integration. It is not proof that Azure supports a
locale, that a resource exists, or that an acoustic assessment has run.

## Existing contracts to reuse

- `SpeechService` remains the single business entry point. The existing
  `SpeechProvider` continues to own STT/TTS and generic coaching; the optional
  `AcousticAssessmentProvider` slot is dedicated to native phonetic evidence
  so Azure can be attached without replacing OpenAI/Gemini speech.
- `ProviderMeteringService` remains responsible for reservation, finalization
  or release and cost attribution.
- `LanguageOralCapabilityMatrix` remains the activation gate.
- `LANGUAGE_MASTERY_PRONUNCIATION_ASSESSMENT_LANGUAGES` remains the
  operational allowlist. It must stay empty for Azure until each locale is
  verified with the exact deployed resource and assessment mode.
- `AssessmentSubmission`, the versioned language-mastery rubric and the
  server decision remain authoritative. A provider result never grants mastery
  directly and no second scoring engine is introduced.

The current speech contract has transcription, synthesis and generic
audio-native analysis. The additive acoustic slot now normalizes results into
the versioned provider-independent `acoustic-assessment-v1` contract. A future
Azure transport must implement that slot. It must not replace the OpenAI
Professor or the existing STT/TTS path.

## Offline software raccord completed

The following is implemented and testable without a credential, resource or
provider call:

- a dedicated provider slot distinct from transcription and generic audio
  analysis;
- explicit scripted-reference and spontaneous modes;
- mandatory accuracy and fluency dimensions, with optional prosody;
- SHA-256 reference fingerprinting without returning or metering the reference
  text;
- preservation of raw provider values and their ranges, without computing a
  vendor-derived mastery score;
- deterministic validation of locale, request/correlation id, duration,
  dimensions, duplicate dimensions and score ranges;
- scoreless `not-evaluable` / `technical-error` results for missing
  capability, unsupported locale/mode, incomplete or malformed output;
- in-flight deduplication and the existing reserve/finalize/release metering
  boundary for a future billable call;
- a conservative 600-second reservation when a compressed input has no trusted
  duration, released down to measured duration after success;
- capability reporting that no longer treats generic audio analysis as
  pronunciation assessment.

The deterministic tests use an in-process simulated provider only. They prove
the software contract and fail-closed behavior; they do **not** prove Azure
wire compatibility, locale support, acoustic quality or operational readiness.
No Azure SDK, endpoint, resource, credential or provider response schema has
been invented from unverified information.

## Required acoustic contract

The A2 phonetic supplement requires both:

1. `scripted-reference`: reading/repetition against a known target;
2. `spontaneous`: a new utterance without a reference answer to copy.

Accuracy and fluency are mandatory dimensions. Prosody is optional and can be
used only when the exact locale/mode/provider response supplies it. A transcript
may support spoken-content evaluation, but `transcriptionSufficient=false`
for pronunciation.

The normalized result must retain at least:

- provider and versioned rubric identifiers;
- requested and provider-reported locale;
- scripted or spontaneous mode;
- reference-text fingerprint when scripted (never the answer in learner logs);
- provider request/correlation identifier;
- per-dimension raw values and their documented ranges;
- audio duration used for metering;
- outcome `evaluated`, `not-evaluable` or `technical-error`;
- a non-secret reason when no valid assessment can be produced.

Second Brain applies its own versioned criteria and raw 90% gate. It must not
map an undocumented vendor aggregate directly to mastery.

## NOT_EVALUABLE mapping

The following remain neutral and award no score, remediation or unlock:

- microphone unavailable or permission denied;
- missing, silent, corrupt or unsupported audio;
- resource, region or credentials unavailable;
- locale not verified for the requested assessment mode;
- required acoustic dimension absent;
- timeout, quota or provider failure;
- response schema/range not validated.

These attempts remain in history. A later fresh attempt may be evaluated, but
must not overwrite the neutral attempt. Written work, STT confidence or a good
transcript cannot substitute for required acoustic proof.

## Registry comparison checkpoint

Second Brain currently registers 34 language codes:

`fr en es de it pt nl pl ru zh ja ko ar hi tr sv vi th el cs ro hu da fi id nb uk ln sw wo ha he zh-Hant bn`.

No current official Azure locale/capability matrix is stored in this repository,
and this continuation explicitly performs no duplicate network research.
Therefore Azure pronunciation support for **every one of these codes is
NOT_VERIFIED**. Language aliases and product codes must be mapped to exact
provider locales only from the current official capability matrix; STT support
must never be reused as pronunciation support.

Until that one-time official comparison and an operational smoke test are
recorded, the allowlist stays empty and the strict path remains
`BLOCKED_CAPABILITY`.

## Single grouped external-prerequisite request

Please approve and supply the following as **one bounded package** before an
Azure transport, resource creation or real call is attempted:

1. **Resource and region:** the exact Azure AI Speech resource identifier,
   subscription/tenant owner, exact region, and exact HTTPS endpoint approved
   for the OVH workload and audio-data requirements. Include the confirmed
   provider retention/deletion setting for that resource.
2. **Private server variables:** provision
   `AZURE_SPEECH_PRONUNCIATION_KEY`,
   `AZURE_SPEECH_PRONUNCIATION_REGION`,
   `AZURE_SPEECH_PRONUNCIATION_ENDPOINT` and the confirmed non-secret
   `AZURE_SPEECH_PRONUNCIATION_API_VERSION`. Keep the operational allowlist in
   `LANGUAGE_MASTERY_PRONUNCIATION_ASSESSMENT_LANGUAGES` empty until smoke
   evidence passes.
3. **Locales and capabilities:** provide the exact provider locale tags selected
   for the pilot and, for each tag, separately confirm scripted-reference,
   spontaneous, accuracy, fluency and (optional) prosody. Mapping from the 34
   product codes to these exact provider tags remains
   `BUSINESS_DECISION_REQUIRED`; no locale is implicitly enabled.
4. **Bounded budget:** authorize at most six **provider attempts**, each using at
   most 30 seconds of audio, at most 180 audio seconds total, and a hard monetary
   stop of EUR 2. The first call remains forbidden until the current official
   rate and billing unit show this cap is sufficient and the stop can be
   enforced. Resource creation or any recurring charge needs the same explicit
   approval.
5. **Secret entry outside chat:** an authorized operator enters the key through
   the existing OVH server-side secret mechanism during an interactive session
   with hidden input. It must never be pasted into chat, committed to Git,
   placed in a browser/client bundle or echoed into command output/logs. Store
   it in the existing root-restricted runtime secret file/store, restart only
   the targeted API service, and report only redacted presence/length and
   configuration checks.
6. **Test handling:** memory/ephemeral audio transfer only, no raw-audio,
   transcript, reference-text or provider-body logging, no Second Brain raw
   audio persistence, and written confirmation of Azure-side retention/deletion
   behavior for the selected resource.

This is a request for prerequisites, not authorization already granted. Until
all six items are supplied together, the acoustic provider token remains
unbound, the pronunciation capability remains false and all 34 product
languages remain `NOT_VERIFIED`.

## Evidence still required after approval

The approved validation must record all of the following together:

1. exact supported locales for scripted and spontaneous assessment, with the
   dimensions available per locale;
2. a proposed compliant Azure region and why it is appropriate for the OVH
   workload and audio-data requirements;
3. the current official price, billing unit and estimated maximum;
4. a bounded test plan: at most six calls, at most 30 seconds each, at most
   180 audio seconds total, and a monetary stop no higher than EUR 2 after the
   official rate makes that estimate provable;
5. private server-side configuration requirements (resource key/endpoint or
   region), never requested or exposed in chat, Git, browser or logs;
6. audio handling: memory/ephemeral transfer only for the test, no raw-audio
   logging, no persistence by Second Brain, and deletion/retention confirmation
   for the selected Azure configuration.

Region, current pricing, provider retention and credentials are
`NOT_VERIFIED` until that grouped approval is prepared from current official
material. No Azure resource, credential, paid call or recurring expense was
created by this readiness work.

## Activation gate

Before adding a language code to the pronunciation allowlist:

- attach the verified Azure transport to the implemented acoustic and metering
  seams;
- validate response schema, ranges and failure mapping deterministically;
- verify scripted and spontaneous modes for the exact locale;
- verify accuracy and fluency; record prosody only if actually returned;
- prove request ownership, idempotence and one-time ledger finalization;
- prove raw audio and secrets are absent from logs and evidence;
- exercise the real microphone path on a technical account;
- confirm failed/technical attempts persist without zero, punishment or unlock.

The global strict language path remains disabled until every mandatory
capability in its advertised scope is genuinely completable.
