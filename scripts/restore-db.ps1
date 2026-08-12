# Restauration PostgreSQL depuis un dump créé par backup-db.ps1.
param([Parameter(Mandatory = $true)][string]$File)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $File)) { throw "Fichier de sauvegarde introuvable : $File" }
$name = Split-Path $File -Leaf

docker cp $File "telecom-postgres:/tmp/$name"
docker exec telecom-postgres pg_restore -U telecom -d telecom_tickets --clean --if-exists "/tmp/$name"
docker exec telecom-postgres rm -f "/tmp/$name"

Write-Host "Restauration terminée depuis : $File"
