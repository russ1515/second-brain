param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseUrl
)

$ErrorActionPreference = 'Stop'
$env:DATABASE_URL = $DatabaseUrl
$env:SPRINT3_BROWSER_FIXTURE_CONFIRM = 'I_UNDERSTAND_TEST_ONLY'
$env:SPRINT3_BROWSER_FIXTURE_ACTION = 'create'
Set-Location (Split-Path $PSScriptRoot -Parent)
& node --env-file=../../.env test/sprint3-browser-fixture.cjs
exit $LASTEXITCODE
