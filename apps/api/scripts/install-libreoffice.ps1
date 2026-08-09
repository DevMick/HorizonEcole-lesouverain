# Script d'installation automatique de LibreOffice
# Usage: powershell -ExecutionPolicy Bypass -File install-libreoffice.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation de LibreOffice" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si LibreOffice est déjà installé
Write-Host "Vérification de l'installation existante..." -ForegroundColor Yellow
$libreOfficePath = $null
$commonPaths = @(
    "C:\Program Files\LibreOffice\program\soffice.exe",
    "C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "$env:PROGRAMFILES\LibreOffice\program\soffice.exe",
    "${env:ProgramFiles(x86)}\LibreOffice\program\soffice.exe"
)

foreach ($path in $commonPaths) {
    if ($path -and (Test-Path $path)) {
        $libreOfficePath = $path
        Write-Host "✅ LibreOffice est déjà installé à: $path" -ForegroundColor Green
        Write-Host ""
        Write-Host "Version installée:" -ForegroundColor Yellow
        & "$path" --version
        Write-Host ""
        Write-Host "Aucune installation nécessaire!" -ForegroundColor Green
        exit 0
    }
}

# Vérifier si winget est disponible (Windows 10/11)
Write-Host "LibreOffice n'est pas installé." -ForegroundColor Yellow
Write-Host "Tentative d'installation via winget..." -ForegroundColor Yellow
Write-Host ""

$wingetAvailable = $false
try {
    $wingetVersion = winget --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $wingetAvailable = $true
        Write-Host "✅ winget est disponible" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  winget n'est pas disponible" -ForegroundColor Yellow
}

if ($wingetAvailable) {
    Write-Host ""
    Write-Host "Installation de LibreOffice via winget..." -ForegroundColor Cyan
    Write-Host "Cela peut prendre quelques minutes..." -ForegroundColor Gray
    Write-Host ""
    
    try {
        # Installer LibreOffice via winget
        $wingetResult = winget install --id TheDocumentFoundation.LibreOffice --accept-package-agreements --accept-source-agreements 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ LibreOffice installé avec succès via winget!" -ForegroundColor Green
            
            # Attendre un peu pour que l'installation se termine
            Start-Sleep -Seconds 5
            
            # Vérifier l'installation
            Write-Host ""
            Write-Host "Vérification de l'installation..." -ForegroundColor Yellow
            foreach ($path in $commonPaths) {
                if ($path -and (Test-Path $path)) {
                    Write-Host "✅ LibreOffice trouvé à: $path" -ForegroundColor Green
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
        } else {
            Write-Host "❌ Erreur lors de l'installation via winget" -ForegroundColor Red
            Write-Host "Tentative d'installation via Chocolatey..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Erreur lors de l'installation via winget: $_" -ForegroundColor Red
        Write-Host "Tentative d'installation via Chocolatey..." -ForegroundColor Yellow
    }
}

# Essayer Chocolatey si disponible
$chocoAvailable = $false
try {
    $chocoVersion = choco --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $chocoAvailable = $true
        Write-Host ""
        Write-Host "✅ Chocolatey est disponible" -ForegroundColor Green
        Write-Host "Installation de LibreOffice via Chocolatey..." -ForegroundColor Cyan
        Write-Host "Cela peut prendre quelques minutes..." -ForegroundColor Gray
        Write-Host ""
        
        try {
            choco install libreoffice -y
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ LibreOffice installé avec succès via Chocolatey!" -ForegroundColor Green
                
                # Attendre un peu pour que l'installation se termine
                Start-Sleep -Seconds 5
                
                # Vérifier l'installation
                Write-Host ""
                Write-Host "Vérification de l'installation..." -ForegroundColor Yellow
                foreach ($path in $commonPaths) {
                    if ($path -and (Test-Path $path)) {
                        Write-Host "✅ LibreOffice trouvé à: $path" -ForegroundColor Green
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
            }
        } catch {
            Write-Host "❌ Erreur lors de l'installation via Chocolatey: $_" -ForegroundColor Red
        }
    }
} catch {
    # Chocolatey n'est pas disponible, continuer avec l'installation manuelle
}

# Si winget n'est pas disponible ou a échoué, proposer l'installation manuelle
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation manuelle requise" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Méthode 1: Téléchargement automatique (recommandé)" -ForegroundColor Cyan
Write-Host "1. Le script va ouvrir la page de téléchargement de LibreOffice" -ForegroundColor White
Write-Host "2. Téléchargez la version Windows (64-bit)" -ForegroundColor White
Write-Host "3. Exécutez l'installateur" -ForegroundColor White
Write-Host "4. Suivez l'assistant d'installation" -ForegroundColor White
Write-Host "5. Redémarrez votre serveur API après l'installation" -ForegroundColor White
Write-Host ""
Write-Host "Méthode 2: Via Chocolatey (si installé)" -ForegroundColor Cyan
Write-Host "   choco install libreoffice" -ForegroundColor Gray
Write-Host ""

# Demander si l'utilisateur veut ouvrir la page de téléchargement
$response = Read-Host "Voulez-vous ouvrir la page de téléchargement maintenant? (O/N)"
if ($response -eq 'O' -or $response -eq 'o' -or $response -eq 'Y' -or $response -eq 'y') {
    Write-Host ""
    Write-Host "Ouverture de la page de téléchargement..." -ForegroundColor Yellow
    Start-Process "https://www.libreoffice.org/download/download/"
    Write-Host ""
    Write-Host "✅ Page de téléchargement ouverte dans votre navigateur" -ForegroundColor Green
    Write-Host ""
    Write-Host "Après l'installation, exécutez:" -ForegroundColor Yellow
    Write-Host "   powershell -ExecutionPolicy Bypass -File scripts/check-libreoffice.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "pour vérifier que LibreOffice est correctement installé." -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Téléchargez LibreOffice depuis:" -ForegroundColor Yellow
    Write-Host "   https://www.libreoffice.org/download/download/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Après l'installation, exécutez:" -ForegroundColor Yellow
    Write-Host "   powershell -ExecutionPolicy Bypass -File scripts/check-libreoffice.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "pour vérifier que LibreOffice est correctement installé." -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

