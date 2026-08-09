# Script pour charger les variables d'environnement depuis .env
# Utilisation: . .\load-env.ps1

$envFile = "..\..\.env"
if (Test-Path $envFile) {
    Write-Host "Chargement des variables d'environnement..." -ForegroundColor Cyan
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
                Write-Host "  $name" -ForegroundColor Gray
            }
        }
    }
    Write-Host "Variables chargees avec succes!" -ForegroundColor Green
    Write-Host "`nVous pouvez maintenant executer:" -ForegroundColor Yellow
    Write-Host "  pnpm prisma migrate status" -ForegroundColor White
    Write-Host "  pnpm prisma migrate deploy" -ForegroundColor White
} else {
    Write-Host "Fichier .env non trouve a: $envFile" -ForegroundColor Red
}

