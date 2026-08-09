# Script pour régénérer le client Prisma après modification du schéma
# Usage: .\regenerate-prisma-client.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  REGENERATION DU CLIENT PRISMA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables d'environnement depuis la racine du projet
$envPath = Join-Path $PSScriptRoot "..\..\.env"
if (Test-Path $envPath) {
    Write-Host "[1/2] Chargement des variables d'environnement..." -ForegroundColor Yellow
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "       OK" -ForegroundColor Green
} else {
    Write-Host "[1/2] Fichier .env non trouvé, utilisation des variables système..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/2] Régénération du client Prisma..." -ForegroundColor Yellow
Write-Host "       (via prisma generate)" -ForegroundColor Gray

# Essayer d'utiliser pnpm si disponible
$pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmPath) {
    Write-Host "       Utilisation de pnpm..." -ForegroundColor Gray
    try {
        & pnpm generate
        if ($LASTEXITCODE -eq 0) {
            Write-Host "       Client Prisma régénéré avec succès" -ForegroundColor Green
        } else {
            Write-Host "       ERREUR lors de la régénération" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "ERREUR" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
} else {
    # Essayer d'utiliser npx si disponible
    $npxPath = Get-Command npx -ErrorAction SilentlyContinue
    if ($npxPath) {
        Write-Host "       Utilisation de npx..." -ForegroundColor Gray
        try {
            & npx prisma generate
            if ($LASTEXITCODE -eq 0) {
                Write-Host "       Client Prisma régénéré avec succès" -ForegroundColor Green
            } else {
                Write-Host "       ERREUR lors de la régénération" -ForegroundColor Red
                exit 1
            }
        } catch {
            Write-Host "ERREUR" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            exit 1
        }
    } else {
        # Essayer de trouver prisma dans node_modules
        $prismaPath = Join-Path $PSScriptRoot "node_modules\.bin\prisma.cmd"
        if (Test-Path $prismaPath) {
            Write-Host "       Utilisation de prisma local..." -ForegroundColor Gray
            try {
                & $prismaPath generate
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "       Client Prisma régénéré avec succès" -ForegroundColor Green
                } else {
                    Write-Host "       ERREUR lors de la régénération" -ForegroundColor Red
                    exit 1
                }
            } catch {
                Write-Host "ERREUR" -ForegroundColor Red
                Write-Host $_.Exception.Message -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "ERREUR: Impossible de trouver pnpm, npx ou prisma" -ForegroundColor Red
            Write-Host "        Veuillez exécuter manuellement: pnpm generate" -ForegroundColor Yellow
            Write-Host "        ou: npx prisma generate" -ForegroundColor Yellow
            exit 1
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TERMINE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

