/** Typed application configuration, assembled from validated environment variables. */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  api: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
  },
  database: {
    url: process.env.DATABASE_URL as string,
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  },
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'gemini',
    model: process.env.LLM_MODEL ?? 'gemini-flash-latest',
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
  embeddings: {
    // 'gemini' calls the Google API; 'fake' produces deterministic local vectors.
    provider: process.env.EMBEDDINGS_PROVIDER ?? 'fake',
    model: process.env.EMBEDDINGS_MODEL ?? 'gemini-embedding-001',
    // Gemini key is shared with the LLM layer.
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
  speech: {
    // 'gemini' does real STT+TTS; 'fake' is a deterministic offline dev
    // transport (UTF-8 text payload in, no TTS).
    provider: process.env.SPEECH_PROVIDER ?? 'fake',
    // Audio-in works on the regular multimodal models; TTS needs a *-tts model.
    sttModel: process.env.SPEECH_STT_MODEL ?? 'gemini-flash-lite-latest',
    ttsModel: process.env.SPEECH_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts',
    voice: process.env.SPEECH_VOICE ?? 'Kore',
    // Gemini key is shared with the LLM layer.
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    // TTLs are seconds.
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '1209600', 10),
    // Email-verification token lifetime (seconds); default 24h.
    emailVerificationTtl: parseInt(
      process.env.EMAIL_VERIFICATION_TTL ?? '86400',
      10,
    ),
    // 2FA login-challenge lifetime (seconds); default 5min.
    twoFactorChallengeTtl: parseInt(
      process.env.TWO_FACTOR_CHALLENGE_TTL ?? '300',
      10,
    ),
    // Email OTP (6-digit code) lifetime (seconds); default 10min.
    otpTtl: parseInt(process.env.OTP_TTL ?? '600', 10),
    // Max wrong OTP guesses before the code is locked out.
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    // Key material for encrypting TOTP secrets at rest. Falls back to the access
    // secret (still 32-byte-derived) when unset; set explicitly in production.
    twoFactorEncKey: process.env.TWO_FACTOR_ENC_KEY,
  },
  mail: {
    // 'log' (dev, prints to console) or 'smtp' (real delivery via nodemailer).
    transport: process.env.MAIL_TRANSPORT ?? 'log',
    from: process.env.MAIL_FROM ?? 'no-reply@secondbrain.local',
    // SMTP settings, only read when MAIL_TRANSPORT=smtp. Gmail defaults:
    // host smtp.gmail.com, port 465 (implicit TLS). Use an App Password as
    // MAIL_PASS (regular Gmail passwords are rejected).
    smtp: {
      host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
      port: parseInt(process.env.MAIL_PORT ?? '465', 10),
      secure: (process.env.MAIL_SECURE ?? 'true') === 'true',
      user: process.env.MAIL_USER ?? '',
      pass: process.env.MAIL_PASS ?? '',
    },
  },
  notify: {
    // Daily-journey nudges. 'log' prints to console; 'mail' rides the mail seam.
    transport: process.env.NOTIFY_TRANSPORT ?? 'log',
  },
  app: {
    // Base URL used to build links inside emails (e.g. the verification link).
    url: process.env.APP_URL ?? 'http://localhost:3000',
  },
});
