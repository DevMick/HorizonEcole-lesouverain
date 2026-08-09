# Script de vérification et configuration de LibreOffice
# Usage: powershell -ExecutionPolicy Bypass -File check-libreoffice.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Vérification de LibreOffice" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$found = $false
$libreOfficePath = $null

# Chemins communs à vérifier
$commonPaths = @(
    "C:\Program Files\LibreOffice\program\soffice.exe",
    "C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "$env:PROGRAMFILES\LibreOffice\program\soffice.exe",
    "${env:ProgramFiles(x86)}\LibreOffice\program\soffice.exe",
    "$env:LOCALAPPDATA\Programs\LibreOffice\program\soffice.exe"
)

Write-Host "Recherche de LibreOffice dans les emplacements communs..." -ForegroundColor Yellow

foreach ($path in $commonPaths) {
    if ($path -and (Test-Path $path)) {
        $found = $true
        $libreOfficePath = $path
        Write-Host "✅ LibreOffice trouvé à: $path" -ForegroundColor Green
        break
    }
}

# Vérifier dans le PATH
if (-not $found) {
    Write-Host "LibreOffice non trouvé dans les emplacements communs." -ForegroundColor Yellow
    Write-Host "Vérification dans le PATH..." -ForegroundColor Yellow
    
    try {
        $version = & soffice --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $found = $true
            $libreOfficePath = "soffice"
            Write-Host "✅ LibreOffice trouvé dans le PATH" -ForegroundColor Green
            Write-Host "   Version: $version" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ LibreOffice non trouvé dans le PATH" -ForegroundColor Red
    }
}

# Vérifier la variable d'environnement
if (-not $found) {
    $envPath = $env:LIBREOFFICE_PATH
    if ($envPath) {
        if (Test-Path $envPath) {
            $found = $true
            $libreOfficePath = $envPath
            Write-Host "✅ LibreOffice trouvé via LIBREOFFICE_PATH: $envPath" -ForegroundColor Green
        } else {
            Write-Host "⚠️  LIBREOFFICE_PATH est défini mais le fichier n'existe pas: $envPath" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($found) {
    Write-Host "✅ LibreOffice est installé et détecté!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Chemin: $libreOfficePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Vous pouvez maintenant générer des reçus PDF." -ForegroundColor Green
} else {
    Write-Host "❌ LibreOffice n'est pas installé ou non détecté" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION:" -ForegroundColor Yellow
    Write-Host "1. Téléchargez LibreOffice depuis: https://www.libreoffice.org/download/" -ForegroundColor White
    Write-Host "2. Installez LibreOffice (emplacement par défaut recommandé)" -ForegroundColor White
    Write-Host "3. Redémarrez le serveur API" -ForegroundColor White
    Write-Host ""
    Write-Host "OU configurez manuellement:" -ForegroundColor Yellow
    Write-Host "1. Trouvez le chemin de soffice.exe (généralement dans:" -ForegroundColor White
    Write-Host "   C:\Program Files\LibreOffice\program\soffice.exe)" -ForegroundColor Gray
    Write-Host "2. Ajoutez dans votre fichier .env:" -ForegroundColor White
    Write-Host "   LIBREOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe" -ForegroundColor Gray
    Write-Host "3. Redémarrez le serveur" -ForegroundColor White
}

Write-Host "========================================" -ForegroundColor Cyan

