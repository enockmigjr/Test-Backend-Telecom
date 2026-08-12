# ============================================================================
# Script PowerShell équivalent au Makefile pour Windows (sans make).
# Usage : .\scripts\dev.ps1 <cible>   (ex. .\scripts\dev.ps1 up)
# Cibles : env, up, down, build, restart, logs, ps, health, migrate, seed,
#          db-reset, test, unit, e2e, lint, typecheck, openapi, db-shell,
#          redis-shell, backup, restore
# ============================================================================
param([Parameter(Mandatory = $true)][string]$Target)

$compose = "docker compose"

switch ($Target) {
  "env" {
    if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
    Write-Host "Fichier .env prêt."
  }
  "up" { Invoke-Expression "$compose up -d" }
  "down" { Invoke-Expression "$compose down" }
  "build" { Invoke-Expression "$compose up -d --build" }
  "restart" { Invoke-Expression "$compose restart api public-frontend" }
  "logs" { Invoke-Expression "$compose logs -f --tail=100 api" }
  "ps" { Invoke-Expression "$compose ps" }
  "health" { Invoke-Expression "$compose ps --format ""table {{.Name}}`t{{.Status}}""" }
  "migrate" { Invoke-Expression "$compose exec api pnpm db:migrate" }
  "seed" { Invoke-Expression "$compose exec api pnpm db:seed" }
  "db-reset" { Invoke-Expression "$compose exec api pnpm db:reset" }
  "test" { pnpm test:all }
  "unit" { pnpm test:unit }
  "e2e" { pnpm test:e2e }
  "lint" { pnpm lint }
  "typecheck" { pnpm exec tsc --noEmit -p tsconfig.json }
  "openapi" { pnpm openapi:export }
  "db-shell" { Invoke-Expression "$compose exec postgres psql -U telecom -d telecom_tickets" }
  "redis-shell" { Invoke-Expression "$compose exec redis redis-cli" }
  "backup" { & "$PSScriptRoot\backup-db.ps1" }
  "restore" { & "$PSScriptRoot\restore-db.ps1" }
  default { Write-Host "Cible inconnue : $Target. Voir l'aide en tête du script." }
}
