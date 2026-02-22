# Jiro — Neon migration script
#
# Usage:
#   .\scripts\migrate-neon.ps1 -ConnectionString "postgresql://..." -Action up
#   .\scripts\migrate-neon.ps1 -ConnectionString "postgresql://..." -Action down
#   .\scripts\migrate-neon.ps1 -ConnectionString "postgresql://..." -Action reset
#
# Actions:
#   up    — run all .up.sql files in order (default)
#   down  — run all .down.sql files in reverse order (drops all tables)
#   reset — run down then up (full wipe and reload)

param(
  [Parameter(Mandatory=$true)]
  [string]$ConnectionString,

  [ValidateSet("up", "down", "reset")]
  [string]$Action = "up"
)

$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$migrationsDir = Join-Path $PSScriptRoot "..\jiro-api\migrations"

function Invoke-Migrations($pattern, $descending) {
  $files = Get-ChildItem "$migrationsDir\$pattern" | Sort-Object Name -Descending:$descending
  foreach ($file in $files) {
    Write-Host "Running $($file.Name)..."
    & $psql $ConnectionString -f $file.FullName
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Failed: $($file.Name)"
      exit 1
    }
  }
}

switch ($Action) {
  "up" {
    Write-Host "--- Running UP migrations ---"
    Invoke-Migrations "*.up.sql" $false
    Write-Host "--- All UP migrations complete ---"
  }
  "down" {
    Write-Host "--- Running DOWN migrations (dropping all tables) ---"
    Invoke-Migrations "*.down.sql" $true
    Write-Host "--- All DOWN migrations complete ---"
  }
  "reset" {
    Write-Host "--- RESET: dropping then reloading schema ---"
    Invoke-Migrations "*.down.sql" $true
    Write-Host "--- Drop complete, reloading... ---"
    Invoke-Migrations "*.up.sql" $false
    Write-Host "--- Reset complete ---"
  }
}
