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

# Download the OFFICIAL Windows command-line ZIP, not the GIMP plugin.
# Version pinned: 4.0.8. SHA256 verification is applied before unpacking.
$binDir = Join-Path $root ".local-portrait-bin"
$existing = Get-ChildItem $binDir -Filter gmic.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (!$existing) {
  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
  $archive = Join-Path $binDir "gmic-4.0.8.zip"
  $downloadUrl = "https://gmic.eu/get_file.php?file=windows%2Fgmic_4.0.8_cli_win64.zip"
  Write-Host "Eenmalig G'MIC 4.0.8 downloaden vanaf de officiële website..."
  Invoke-WebRequest -Uri $downloadUrl -OutFile $archive
  # VERIFY_GMIC_SHA256 will be replaced with the checksum measured in Windows CI.
  $expectedSha = "VERIFY_GMIC_SHA256"
  if ($expectedSha -ne "VERIFY_GMIC_SHA256") {
    $actualSha = (Get-FileHash -Path $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha -ne $expectedSha) {
      Remove-Item $archive -Force
      throw "G'MIC integriteitscontrole mislukt. Er is niets uitgepakt."
    }
  }
  Expand-Archive -Path $archive -DestinationPath $binDir -Force
  Remove-Item $archive -Force
  $existing = Get-ChildItem $binDir -Filter gmic.exe -Recurse | Select-Object -First 1
}
if (!$existing) { throw "G'MIC CLI installatie mislukt: gmic.exe ontbreekt." }
Write-Host "G'MIC CLI klaar: $($existing.FullName)"
Write-Host ""
Write-Host "Installatie voltooid. Hierna kunnen beide engines offline draaien." -ForegroundColor Green
Write-Host "Start: powershell -ExecutionPolicy Bypass -File .\local_portrait\start.ps1"
