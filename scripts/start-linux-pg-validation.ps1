<#
Creates one isolated Linux-in-Docker validation run for the Sprint 5
PostgreSQL gate. It deliberately retains the project after execution so the
result can be inspected. Cleanup is manual and only for this generated project.
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 10)]
    [int]$Repeats = 3
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeFile = Join-Path $repositoryRoot 'docker-compose.linux-validation.yml'
$runId = "$(Get-Date -Format 'yyyyMMddHHmmss')-$((New-Guid).ToString('N').Substring(0, 8))"
$project = "sb-linux-gate-55-$runId"
$temporaryVariableNames = @(
    'SB_LINUX_VALIDATION_POSTGRES_PASSWORD',
    'SB_LINUX_VALIDATION_POSTGRES_USER',
    'SB_LINUX_VALIDATION_POSTGRES_DB',
    'SB_LINUX_VALIDATION_FRESH_DATABASE',
    'SB_LINUX_VALIDATION_RUN_ID',
    'SB_LINUX_VALIDATION_COMPOSE_MARKER',
    'SPRINT5_VALIDATION_REPEATS'
)

try {
    # The generated value is URL-safe, test-only, and never written or printed.
    $env:SB_LINUX_VALIDATION_POSTGRES_PASSWORD = (New-Guid).ToString('N')
    $env:SB_LINUX_VALIDATION_POSTGRES_USER = 'secondbrain_validation'
    $env:SB_LINUX_VALIDATION_POSTGRES_DB = "second_brain_sprint5_test_$($runId -replace '-', '')"
    $env:SB_LINUX_VALIDATION_FRESH_DATABASE = 'I_CONFIRM_FRESH_VALIDATION_DATABASE'
    $env:SB_LINUX_VALIDATION_RUN_ID = $runId
    $env:SB_LINUX_VALIDATION_COMPOSE_MARKER = 'SECOND_BRAIN_LINUX_VALIDATION'
    $env:SPRINT5_VALIDATION_REPEATS = "$Repeats"

    Write-Output "Starting isolated Linux validation project: $project"
    & docker compose -p $project -f $composeFile up -d --build --wait runner
    if ($LASTEXITCODE -ne 0) {
        throw "The isolated Linux validation environment did not become ready (exit $LASTEXITCODE)."
    }

    & docker compose -p $project -f $composeFile exec -T runner sh /workspace/scripts/run-linux-pg-validation.sh
    $validationExitCode = $LASTEXITCODE

    if ($validationExitCode -ne 0) {
        throw "The Linux PostgreSQL validation exited with code $validationExitCode."
    }

    Write-Output "Linux PostgreSQL validation completed: $project"
}
finally {
    foreach ($name in $temporaryVariableNames) {
        Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    }

    Write-Output "Project retained for evidence only: $project"
    Write-Output "After evidence review and explicit cleanup approval: docker compose -p $project -f `"$composeFile`" down -v"
}
