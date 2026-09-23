param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

$ErrorActionPreference = 'Stop'
$env:DATABASE_URL = $DatabaseUrl
$env:API_PORT = '3103'
$env:REDIS_HOST = '127.0.0.1'
$env:REDIS_PORT = '16380'
$env:QDRANT_URL = 'http://127.0.0.1:16333'
$env:NODE_ENV = 'test'
$env:CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:8083'
$apiRoot = Split-Path -Parent $PSScriptRoot

# The process reads ordinary app secrets from the existing root .env; only its
# database and local validation endpoints are overridden above.
$process = Start-Process -FilePath 'node.exe' -ArgumentList @('--env-file=../../.env', 'dist/main.js') -WorkingDirectory $apiRoot -WindowStyle Hidden -PassThru
$process.Id
