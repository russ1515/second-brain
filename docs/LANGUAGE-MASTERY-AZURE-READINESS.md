# Language Mastery — Azure pronunciation assessment readiness

Status: **integration preparation complete; acoustic capability not activated**.

This note records the bounded preparation for the proposed Azure Speech
Pronunciation Assessment integration. It is not proof that Azure supports a
locale, that a resource exists, or that an acoustic assessment has run.

## Existing contracts to reuse

- `SpeechProvider` / `SpeechService` remain the single provider seam.
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
audio-native analysis. A future Azure adapter must be additive at this seam and
normalize provider results into a versioned, provider-independent acoustic
result. It must not replace the OpenAI Professor or the existing STT/TTS path.

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

## Single grouped approval before any paid resource or call

The approval request must present all of the following together:

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

- implement the adapter through the existing speech and metering seams;
- validate response schema, ranges and failure mapping deterministically;
- verify scripted and spontaneous modes for the exact locale;
- verify accuracy and fluency; record prosody only if actually returned;
- prove request ownership, idempotence and one-time ledger finalization;
- prove raw audio and secrets are absent from logs and evidence;
- exercise the real microphone path on a technical account;
- confirm failed/technical attempts persist without zero, punishment or unlock.

The global strict language path remains disabled until every mandatory
capability in its advertised scope is genuinely completable.
