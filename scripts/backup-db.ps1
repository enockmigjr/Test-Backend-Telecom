# Sauvegarde PostgreSQL (dump SQL) dans backups/.
param([string]$OutDir = "backups")

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $OutDir "telecom-$stamp.sql"

docker exec telecom-postgres pg_dump -U telecom -d telecom_tickets -F c -f "/tmp/telecom-$stamp.dump"
docker cp "telecom-postgres:/tmp/telecom-$stamp.dump" $file
docker exec telecom-postgres rm -f "/tmp/telecom-$stamp.dump"

Write-Host "Sauvegarde créée : $file"
