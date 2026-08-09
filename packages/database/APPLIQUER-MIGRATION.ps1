# Script final pour appliquer la migration de paie
# Executez ce script depuis packages/database avec: .\APPLIQUER-MIGRATION.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION DE LA MIGRATION DE PAIE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables depuis .env
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "[1/3] Chargement des variables..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#')) {
            $parts = $line.Split('=', 2)
            if ($parts.Length -eq 2) {
                $name = $parts[0].Trim()
                $value = $parts[1].Trim()
                $value = $value -replace '^["'']|["'']$', ''
                Set-Item -Path "env:$name" -Value $value
            }
        }
    }
    Write-Host "       OK" -ForegroundColor Green
} else {
    Write-Host "ERREUR: .env non trouve" -ForegroundColor Red
    exit 1
}

if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL manquante" -ForegroundColor Red
    exit 1
}

# Appliquer la migration
Write-Host "[2/3] Application de la migration..." -ForegroundColor Yellow
& pnpm prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR" -ForegroundColor Red
    exit 1
}
Write-Host "       OK" -ForegroundColor Green

# Générer le client
Write-Host "[3/3] Generation du client Prisma..." -ForegroundColor Yellow
& pnpm prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR" -ForegroundColor Red
    exit 1
}
Write-Host "       OK" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  MIGRATION APPLIQUEE AVEC SUCCES!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

