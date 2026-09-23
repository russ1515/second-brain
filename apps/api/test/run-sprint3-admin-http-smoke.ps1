param(
  [string] $BaseUrl = 'http://127.0.0.1:3104'
)

$ErrorActionPreference = 'Stop'
$apiDirectory = Split-Path $PSScriptRoot -Parent
Set-Location $apiDirectory
$env:DATABASE_URL = 'postgresql://sb_sprint3@127.0.0.1:15433/secondbrain_sprint3?schema=public'
$env:SPRINT3_BROWSER_FIXTURE_CONFIRM = 'I_UNDERSTAND_TEST_ONLY'
$env:SPRINT3_API_BASE_URL = $BaseUrl

& node --env-file=../../.env test/sprint3-admin-http-smoke.cjs
exit $LASTEXITCODE
