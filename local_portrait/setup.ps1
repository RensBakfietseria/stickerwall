$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3.11 -c "import sys; print(sys.version)" 2>$null
  if ($LASTEXITCODE -eq 0) {
    & py -3.11 -m venv ".local-portrait-venv"
  } else {
    & py -3 -m venv ".local-portrait-venv"
  }
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  & python -m venv ".local-portrait-venv"
} else {
  throw "Installeer eerst Python 3.11 of 3.12."
}
$python = Join-Path $root ".local-portrait-venv\Scripts\python.exe"
if (!(Test-Path $python)) { throw "Python-omgeving niet aangemaakt." }
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip upgrade mislukt." }
& $python -m pip install -r "local_portrait\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw "Installatie van Python-pakketten mislukt." }
& $python "local_portrait\download_assets.py"
if ($LASTEXITCODE -ne 0) { throw "Download van model/filter mislukt." }

if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js 22+ ontbreekt. Installeer Node.js en voer setup.ps1 opnieuw uit."
}
& npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci mislukt." }
& npm run stickerwall:build
if ($LASTEXITCODE -ne 0) { throw "Stickerwall-build mislukt." }

Write-Host ""
Write-Host "Klaar. Download ook de G'MIC Command Line Interface via https://gmic.eu/download.html" -ForegroundColor Yellow
Write-Host "Voeg gmic.exe toe aan PATH of stel STICKERWALL_GMIC in voor de G'MIC-route."
Write-Host "Start daarna: powershell -ExecutionPolicy Bypass -File .\local_portrait\start.ps1"
