param(
  [int] $Port = 3104,
  [int] $StepUpTtlSeconds = 600
)

# Dedicated foreground API for browser validation.  The explicit isolated URL
# prevents an accidental fallback to the developer's default database.
$ErrorActionPreference = 'Stop'
$apiDirectory = Split-Path $PSScriptRoot -Parent
Set-Location $apiDirectory
$env:DATABASE_URL = 'postgresql://sb_sprint3@127.0.0.1:15433/secondbrain_sprint3?schema=public'
$env:API_PORT = [string] $Port
$env:REDIS_HOST = '127.0.0.1'
$env:REDIS_PORT = '16380'
$env:QDRANT_URL = 'http://127.0.0.1:16333'
$env:NODE_ENV = 'test'
$env:CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:8083'
$env:ADMIN_STEP_UP_TTL = [string] $StepUpTtlSeconds

& node --env-file=../../.env dist/main.js
exit $LASTEXITCODE
