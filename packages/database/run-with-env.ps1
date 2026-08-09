# Script pour charger les variables d'environnement et exécuter une commande Prisma
param(
    [Parameter(Mandatory=$true)]
    [string]$Command
)

# Charger les variables depuis .env à la racine
$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "Chargement des variables d'environnement depuis .env..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#')) {
            $parts = $line.Split('=', 2)
            if ($parts.Length -eq 2) {
                $name = $parts[0].Trim()
                $value = $parts[1].Trim()
                # Nettoyer les guillemets
                $value = $value -replace '^["'']|["'']$', ''
                Set-Item -Path "env:$name" -Value $value
            }
        }
    }
    Write-Host "Variables chargees" -ForegroundColor Green
} else {
    Write-Host "Fichier .env non trouve a: $envFile" -ForegroundColor Red
    exit 1
}

# Vérifier que DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "DATABASE_URL non definie apres chargement" -ForegroundColor Red
    exit 1
}

Write-Host "`nExecution de: pnpm prisma $Command" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor DarkGray

# Exécuter la commande
& pnpm prisma $Command

