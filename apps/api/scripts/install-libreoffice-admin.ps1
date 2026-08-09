# Installation de LibreOffice avec privilèges administrateur
# Ce script doit être exécuté en tant qu'administrateur

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation de LibreOffice via Chocolatey" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier les privilèges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ Ce script nécessite des privilèges administrateur" -ForegroundColor Red
    Write-Host ""
    Write-Host "Relancement en tant qu'administrateur..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

# Nettoyer les verrous Chocolatey si nécessaire
Write-Host "Nettoyage des verrous Chocolatey..." -ForegroundColor Yellow
$lockFile = "C:\ProgramData\chocolatey\lib\cb70624374e56fe99721918f36d18588d8e62f2f"
if (Test-Path $lockFile) {
    try {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Verrou supprimé" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Impossible de supprimer le verrou: $_" -ForegroundColor Yellow
    }
}

# Vérifier si déjà installé
Write-Host ""
Write-Host "Vérification de l'installation existante..." -ForegroundColor Yellow
$commonPaths = @(
    "C:\Program Files\LibreOffice\program\soffice.exe",
    "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
)

foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        Write-Host "✅ LibreOffice est déjà installé à: $path" -ForegroundColor Green
        & "$path" --version
        exit 0
    }
}

# Installer via Chocolatey
Write-Host ""
Write-Host "Installation de LibreOffice via Chocolatey..." -ForegroundColor Cyan
Write-Host "Cela peut prendre plusieurs minutes..." -ForegroundColor Yellow
Write-Host ""

try {
    choco install libreoffice -y --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Installation réussie!" -ForegroundColor Green
        
        # Attendre un peu
        Start-Sleep -Seconds 5
        
        # Vérifier
        Write-Host ""
        Write-Host "Vérification de l'installation..." -ForegroundColor Yellow
        foreach ($path in $commonPaths) {
            if (Test-Path $path) {
                Write-Host "✅ LibreOffice installé avec succès à: $path" -ForegroundColor Green
                Write-Host ""
                Write-Host "Version installée:" -ForegroundColor Yellow
                & "$path" --version
                Write-Host ""
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host "✅ Installation terminée avec succès!" -ForegroundColor Green
                Write-Host "Vous pouvez maintenant redémarrer votre serveur API." -ForegroundColor Green
                Write-Host "========================================" -ForegroundColor Cyan
                exit 0
            }
        }
        
        Write-Host "⚠️  Installation terminée mais LibreOffice non détecté automatiquement" -ForegroundColor Yellow
        Write-Host "Redémarrez votre ordinateur ou vérifiez manuellement." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Erreur lors de l'installation" -ForegroundColor Red
        Write-Host "Code de sortie: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")











