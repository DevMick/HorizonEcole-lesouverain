# Script d'installation automatique complète de LibreOffice
# Télécharge et installe LibreOffice automatiquement
# Usage: powershell -ExecutionPolicy Bypass -File install-libreoffice-auto.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Automatique de LibreOffice" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier les privilèges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Ce script nécessite des privilèges administrateur" -ForegroundColor Yellow
    Write-Host "Relancez PowerShell en tant qu'administrateur" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ou exécutez:" -ForegroundColor Cyan
    Write-Host "   Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy Bypass -File `"$PSCommandPath`"'" -ForegroundColor Gray
    Write-Host ""
    $response = Read-Host "Voulez-vous relancer en tant qu'administrateur maintenant? (O/N)"
    if ($response -eq 'O' -or $response -eq 'o' -or $response -eq 'Y' -or $response -eq 'y') {
        Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
        exit
    }
}

# Vérifier si déjà installé
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

# Méthode 1: Essayer winget
Write-Host ""
Write-Host "Méthode 1: Installation via winget..." -ForegroundColor Cyan
try {
    $wingetCheck = winget --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ winget disponible" -ForegroundColor Green
        Write-Host "Téléchargement et installation en cours..." -ForegroundColor Yellow
        
        # Essayer avec différentes versions
        $packages = @(
            "TheDocumentFoundation.LibreOffice",
            "LibreOffice.LibreOffice"
        )
        
        foreach ($package in $packages) {
            Write-Host "Tentative avec: $package" -ForegroundColor Gray
            $result = winget install --id $package --silent --accept-package-agreements --accept-source-agreements 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Installation réussie via winget!" -ForegroundColor Green
                Start-Sleep -Seconds 5
                
                # Vérifier
                foreach ($path in $commonPaths) {
                    if (Test-Path $path) {
                        Write-Host "✅ LibreOffice installé à: $path" -ForegroundColor Green
                        & "$path" --version
                        Write-Host ""
                        Write-Host "========================================" -ForegroundColor Cyan
                        Write-Host "✅ Installation terminée avec succès!" -ForegroundColor Green
                        Write-Host "========================================" -ForegroundColor Cyan
                        exit 0
                    }
                }
            }
        }
    }
} catch {
    Write-Host "⚠️  winget non disponible" -ForegroundColor Yellow
}

# Méthode 2: Essayer Chocolatey
Write-Host ""
Write-Host "Méthode 2: Installation via Chocolatey..." -ForegroundColor Cyan
try {
    $chocoCheck = choco --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Chocolatey disponible" -ForegroundColor Green
        Write-Host "Téléchargement et installation en cours..." -ForegroundColor Yellow
        
        choco install libreoffice -y --force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Installation réussie via Chocolatey!" -ForegroundColor Green
            Start-Sleep -Seconds 5
            
            # Vérifier
            foreach ($path in $commonPaths) {
                if (Test-Path $path) {
                    Write-Host "✅ LibreOffice installé à: $path" -ForegroundColor Green
                    & "$path" --version
                    Write-Host ""
                    Write-Host "========================================" -ForegroundColor Cyan
                    Write-Host "✅ Installation terminée avec succès!" -ForegroundColor Green
                    Write-Host "========================================" -ForegroundColor Cyan
                    exit 0
                }
            }
        }
    }
} catch {
    Write-Host "⚠️  Chocolatey non disponible" -ForegroundColor Yellow
}

# Méthode 3: Téléchargement direct et installation
Write-Host ""
Write-Host "Méthode 3: Téléchargement direct depuis le site officiel..." -ForegroundColor Cyan
Write-Host "Cette méthode peut prendre plusieurs minutes..." -ForegroundColor Yellow
Write-Host ""

# URL de téléchargement (version stable)
$downloadUrl = "https://download.documentfoundation.org/libreoffice/stable/24.8.2/win/x86_64/LibreOffice_24.8.2_Win_x86-64.msi"
$tempDir = $env:TEMP
$installerPath = Join-Path $tempDir "LibreOffice_Installer.msi"

try {
    Write-Host "Téléchargement de LibreOffice..." -ForegroundColor Yellow
    Write-Host "URL: $downloadUrl" -ForegroundColor Gray
    Write-Host "Destination: $installerPath" -ForegroundColor Gray
    Write-Host ""
    
    # Télécharger avec progress bar
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    
    if (Test-Path $installerPath) {
        Write-Host "✅ Téléchargement terminé" -ForegroundColor Green
        Write-Host ""
        Write-Host "Installation en cours..." -ForegroundColor Yellow
        Write-Host "Cela peut prendre quelques minutes, veuillez patienter..." -ForegroundColor Gray
        Write-Host ""
        
        # Installer en mode silencieux
        $installArgs = "/i `"$installerPath`" /quiet /norestart"
        $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait -PassThru
        
        if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
            Write-Host "✅ Installation terminée!" -ForegroundColor Green
            
            # Nettoyer le fichier d'installation
            if (Test-Path $installerPath) {
                Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
            }
            
            Start-Sleep -Seconds 3
            
            # Vérifier l'installation
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
            Write-Host "❌ Erreur lors de l'installation. Code de sortie: $($process.ExitCode)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Échec du téléchargement" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tentative avec une URL alternative..." -ForegroundColor Yellow
    
    # URL alternative (version plus récente)
    try {
        $altUrl = "https://download.documentfoundation.org/libreoffice/stable/25.2.0/win/x86_64/LibreOffice_25.2.0_Win_x86-64.msi"
        Write-Host "Téléchargement depuis: $altUrl" -ForegroundColor Gray
        
        Invoke-WebRequest -Uri $altUrl -OutFile $installerPath -UseBasicParsing
        
        if (Test-Path $installerPath) {
            Write-Host "✅ Téléchargement terminé" -ForegroundColor Green
            Write-Host "Installation en cours..." -ForegroundColor Yellow
            
            $installArgs = "/i `"$installerPath`" /quiet /norestart"
            $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait -PassThru
            
            if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
                Write-Host "✅ Installation terminée!" -ForegroundColor Green
                
                if (Test-Path $installerPath) {
                    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
                }
                
                Start-Sleep -Seconds 3
                
                foreach ($path in $commonPaths) {
                    if (Test-Path $path) {
                        Write-Host "✅ LibreOffice installé avec succès!" -ForegroundColor Green
                        & "$path" --version
                        exit 0
                    }
                }
            }
        }
    } catch {
        Write-Host "❌ Échec de l'installation automatique" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation manuelle requise" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Téléchargez LibreOffice depuis:" -ForegroundColor Yellow
Write-Host "   https://www.libreoffice.org/download/download/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ou installez Chocolatey puis exécutez:" -ForegroundColor Yellow
Write-Host "   choco install libreoffice -y" -ForegroundColor Gray
Write-Host ""











