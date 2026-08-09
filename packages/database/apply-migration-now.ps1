# Script pour appliquer la migration de paie
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application de la migration de paie" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables depuis .env
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "[1/3] Chargement des variables d'environnement..." -ForegroundColor Yellow
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
    Write-Host "       Variables chargees" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL non definie" -ForegroundColor Red
    exit 1
}

# Appliquer la migration
Write-Host "[2/3] Application de la migration..." -ForegroundColor Yellow
& pnpm prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de l'application de la migration" -ForegroundColor Red
    exit 1
}

# Générer le client
Write-Host "[3/3] Generation du client Prisma..." -ForegroundColor Yellow
& pnpm prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la generation du client" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

