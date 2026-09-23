param(
  [Parameter(Mandatory = $true)]
  [string] $ApiTarget
)

$ErrorActionPreference = 'Stop'
$adminDirectory = Split-Path $PSScriptRoot -Parent
Set-Location $adminDirectory
$env:ADMIN_API_PROXY_TARGET = $ApiTarget

& node test/serve-static.cjs
exit $LASTEXITCODE
