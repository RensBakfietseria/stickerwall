$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$python = Join-Path $root ".local-portrait-venv\Scripts\python.exe"
# Reuse the working 0.3 environment. Never move a Windows venv.
if (!(Test-Path $python)) {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3.11 -m venv ".local-portrait-venv"
    if ($LASTEXITCODE -ne 0) { throw "Python 3.11 ontbreekt of de omgeving kon niet worden gemaakt." }
  } else {
    throw "Installeer eerst Python 3.11. Gebruik een korte projectmap direct op C:."
  }
}
if (!(Test-Path $python)) { throw "Python-omgeving niet aangemaakt." }
& $python -c "import PIL, numpy, onnxruntime; print('Python-omgeving klaar')"
if (($LASTEXITCODE -ne 0) -or ($env:STICKERWALL_REFRESH_PYTHON -eq "1")) {
  & $python -m pip install -r "local_portrait\requirements.txt"
  if ($LASTEXITCODE -ne 0) { throw "Python-pakketten installeren mislukt. Controleer ook de padlengte." }
}
# Download only missing/changed models; the existing OpenSketch file is reused.
& $python "local_portrait\download_assets.py"
if ($LASTEXITCODE -ne 0) { throw "Modeldownload of integriteitscontrole mislukt." }

if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "Node.js 22+ ontbreekt."
}
if (!(Test-Path "node_modules\.bin\vite.cmd") -or ($env:STICKERWALL_REFRESH_NODE -eq "1")) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci mislukt." }
}
& npm.cmd run stickerwall:build
if ($LASTEXITCODE -ne 0) { throw "Stickerwall-build mislukt." }

# No G'MIC download/execution or changes to Windows security.
Write-Host "Artistiek Portretlab 0.4 klaar: OpenSketch, Contour en Anime." -ForegroundColor Green
Write-Host "Internet mag uit. Start: powershell -ExecutionPolicy Bypass -File .\local_portrait\start.ps1"
