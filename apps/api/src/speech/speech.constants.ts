/** DI token for the active speech provider implementation. */
export const SPEECH_PROVIDER = Symbol('SPEECH_PROVIDER');

/** Optional, dedicated provider for native pronunciation assessment.
 * It never replaces the active STT/TTS provider. */
export const ACOUSTIC_ASSESSMENT_PROVIDER = Symbol(
  'ACOUSTIC_ASSESSMENT_PROVIDER',
);
