$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $repositoryRoot
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8083/api'
$env:EXPO_PUBLIC_ADMIN_ENVIRONMENT = 'TEST'

& pnpm --filter @second-brain/admin build
exit $LASTEXITCODE
