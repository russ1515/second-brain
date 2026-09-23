param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseUrl
)

# Keeps the user's current clipboard data object in memory while the disposable
# Sprint 3 fixture supplies the password or TOTP to the local test browser.
# It intentionally writes no credential or clipboard contents to stdout.
$ErrorActionPreference = 'Stop'

$apiDirectory = Split-Path $PSScriptRoot -Parent
Set-Location $apiDirectory
$env:DATABASE_URL = $DatabaseUrl
$env:SPRINT3_BROWSER_FIXTURE_CONFIRM = 'I_UNDERSTAND_TEST_ONLY'

Add-Type -AssemblyName System.Windows.Forms
$savedClipboard = [System.Windows.Forms.Clipboard]::GetDataObject()

function Invoke-FixtureClipboardAction([string] $fixtureAction) {
  $env:SPRINT3_BROWSER_FIXTURE_ACTION = $fixtureAction
  & node --env-file=../../.env test/sprint3-browser-fixture.cjs
  if ($LASTEXITCODE -ne 0) {
    throw "The disposable browser fixture could not prepare the $fixtureAction value."
  }
}

try {
  Write-Output 'SPRINT3_CLIPBOARD_BRIDGE_READY'
  while ($true) {
    $command = [Console]::ReadLine()
    if ($null -eq $command) { break }

    switch ($command) {
      'create' {
        Invoke-FixtureClipboardAction 'create'
        Write-Output 'SPRINT3_FIXTURE_READY'
      }
      'password' {
        Invoke-FixtureClipboardAction 'copy-password'
        Write-Output 'SPRINT3_PASSWORD_READY'
      }
      'totp' {
        Invoke-FixtureClipboardAction 'copy-totp'
        Write-Output 'SPRINT3_TOTP_READY'
      }
      'restore' {
        if ($null -ne $savedClipboard) {
          [System.Windows.Forms.Clipboard]::SetDataObject($savedClipboard, $true)
        }
        Write-Output 'SPRINT3_CLIPBOARD_RESTORED'
      }
      'exit' { break }
      default { Write-Output 'SPRINT3_CLIPBOARD_BRIDGE_UNKNOWN_COMMAND' }
    }
  }
} finally {
  if ($null -ne $savedClipboard) {
    [System.Windows.Forms.Clipboard]::SetDataObject($savedClipboard, $true)
  }
}
