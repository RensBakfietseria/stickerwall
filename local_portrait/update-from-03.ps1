param(
  [Parameter(Mandatory=$true)]
  [string]$TargetRoot,
  [switch]$CopyOnly
)
$ErrorActionPreference = "Stop"
$source = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = (Resolve-Path -LiteralPath $TargetRoot).Path
if ($source -eq $target) { throw "Open deze updater vanuit de uitgepakte 0.4-map, niet vanuit de doelmap." }
if (!(Test-Path (Join-Path $source "src\stickerwall\ink.ts"))) { throw "De bronmap bevat geen volledige Build 0.4." }
if (!(Test-Path (Join-Path $target "stickerwall.html")) -or
    !(Test-Path (Join-Path $target "local_portrait\setup.ps1"))) {
  throw "Doelmap is geen bestaande Stickerwall-installatie."
}
if (!(Test-Path (Join-Path $target ".local-portrait-venv\Scripts\python.exe"))) {
  throw "Bestaande Python-omgeving niet gevonden. Kies de map waarin 0.3 werkt."
}
if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
  $listener = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
  if ($listener) { throw "Sluit eerst de oude lokale Stickerwall-server met Ctrl+C." }
}

# Overlay application source only; don't touch installed Python/Node,
# downloaded model assets, personal files or Windows security settings.
$relative = @(
  "stickerwall.html",
  "STICKERWALL.md",
  "src\stickerwall\ink.ts",
  "src\stickerwall\local-comparison.ts",
  "src\stickerwall\main.ts",
  "src\stickerwall\style.css",
  "local_portrait\processing.py",
  "local_portrait\server.py",
  "local_portrait\download_assets.py",
  "local_portrait\requirements.txt",
  "local_portrait\setup.ps1",
  "local_portrait\start.ps1",
  "local_portrait\smoke_test.py",
  "local_portrait\test_processing.py",
  "local_portrait\README.md",
  "local_portrait\APDRAWINGGAN.md"
)
foreach ($file in $relative) {
  if (!(Test-Path -LiteralPath (Join-Path $source $file))) { throw "Bronbestand ontbreekt: $file" }
}
foreach ($file in $relative) {
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $target $file) -Force
}
Write-Host "Code bijgewerkt in $target. Modellen en Python-omgeving behouden." -ForegroundColor Green
if ($CopyOnly) { exit 0 }
Push-Location $target
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\local_portrait\setup.ps1"
  if ($LASTEXITCODE -ne 0) { throw "Update-installatie mislukt; voer setup.ps1 opnieuw uit in de doelmap." }
} finally {
  Pop-Location
}
Write-Host "Open PowerShell in de bestaande installatie en start local_portrait\start.ps1."
