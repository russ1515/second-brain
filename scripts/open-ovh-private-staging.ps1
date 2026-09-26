[CmdletBinding()]
param(
  [string]$SshTarget = 'ubuntu@148.113.251.198',
  [ValidateRange(1024, 65535)]
  [int]$UserPort = 18084,
  [ValidateRange(1024, 65535)]
  [int]$AdminPort = 18083,
  [switch]$OpenPages
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$userUrl = "http://127.0.0.1:$UserPort/"
$adminUrl = "http://127.0.0.1:$AdminPort/login"

function Get-HttpStatusCode {
  param([Parameter(Mandatory)][string]$Url)

  try {
    $statusCode = & curl.exe --fail --silent --show-error --max-time 5 --output NUL --write-out '%{http_code}' $Url 2>$null
    if ($LASTEXITCODE -eq 0) {
      return [int]$statusCode
    }
  } catch {
    return 0
  }

  return 0
}

function Test-UserEndpoint {
  param([Parameter(Mandatory)][string]$BaseUrl)

  try {
    if ((Get-HttpStatusCode -Url $BaseUrl) -ne 200) {
      return $false
    }

    $healthText = (& curl.exe --fail --silent --show-error --max-time 5 "${BaseUrl}api/health" 2>$null) -join "`n"
    if ($LASTEXITCODE -ne 0) {
      return $false
    }
    $health = $healthText | ConvertFrom-Json

    $adminStatus = & curl.exe --silent --show-error --max-time 5 --output NUL --write-out '%{http_code}' "${BaseUrl}api/admin" 2>$null
    return $LASTEXITCODE -eq 0 -and
      $adminStatus -eq '404' -and
      $health.status -eq 'ok' -and
      $health.info.postgres.status -eq 'up' -and
      $health.info.redis.status -eq 'up' -and
      $health.info.qdrant.status -eq 'up'
  } catch {
    return $false
  }
}

function Test-AdminEndpoint {
  param([Parameter(Mandatory)][string]$Url)

  try {
    if ((Get-HttpStatusCode -Url $Url) -ne 200) {
      return $false
    }

    $html = (& curl.exe --fail --silent --show-error --max-time 5 $Url 2>$null) -join "`n"
    return $LASTEXITCODE -eq 0 -and $html -match '<title>Second Brain.+Control Center</title>'
  } catch {
    return $false
  }
}

function Get-ListeningProcessIds {
  param([Parameter(Mandatory)][int]$Port)

  @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
}

$userReady = Test-UserEndpoint -BaseUrl $userUrl
$adminReady = Test-AdminEndpoint -Url $adminUrl

if ($userReady -and $adminReady) {
  Write-Host 'Les tunnels existants repondent deja. Aucun second processus SSH n a ete lance.'
} else {
  $userOwners = @(Get-ListeningProcessIds -Port $UserPort)
  $adminOwners = @(Get-ListeningProcessIds -Port $AdminPort)

  if ($userOwners.Count -gt 0 -or $adminOwners.Count -gt 0) {
    throw "Le port $UserPort ou $AdminPort est deja utilise, mais les deux endpoints Second Brain ne sont pas valides. Aucun processus existant n'a ete arrete."
  }

  $sshArguments = @(
    '-N',
    '-o', 'BatchMode=yes',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'StrictHostKeyChecking=yes',
    '-L', "${UserPort}:127.0.0.1:8082",
    '-L', "${AdminPort}:127.0.0.1:8083",
    $SshTarget
  )

  $sshProcess = Start-Process -FilePath 'ssh.exe' -ArgumentList $sshArguments -WindowStyle Hidden -PassThru
  $ready = $false

  foreach ($attempt in 1..15) {
    if ($sshProcess.HasExited) {
      break
    }

    if ((Test-UserEndpoint -BaseUrl $userUrl) -and (Test-AdminEndpoint -Url $adminUrl)) {
      $ready = $true
      break
    }

    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    if (-not $sshProcess.HasExited) {
      Stop-Process -Id $sshProcess.Id -ErrorAction SilentlyContinue
    }
    throw 'Le tunnel SSH nouvellement cree n a pas valide les deux endpoints. Verifie la cle SSH et la disponibilite du VPS.'
  }

  Write-Host "Tunnel SSH valide (PID $($sshProcess.Id))."
}

Write-Host "Landing User : $userUrl"
Write-Host "Connexion    : ${userUrl}sign-in?mode=login"
Write-Host "Inscription  : ${userUrl}sign-in?mode=register"
Write-Host "Admin prive  : $adminUrl"

if ($OpenPages) {
  Start-Process $userUrl
  Start-Process $adminUrl
}
