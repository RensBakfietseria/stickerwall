$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
$python = Join-Path $root ".local-portrait-venv\Scripts\python.exe"
if (!(Test-Path $python)) {
  throw "Voer eerst powershell -ExecutionPolicy Bypass -File .\local_portrait\setup.ps1 uit."
}
if (!(Test-Path (Join-Path $root "dist-stickerwall\stickerwall.html"))) {
  throw "De website-build ontbreekt. Voer npm run stickerwall:build uit."
}
Start-Process "http://127.0.0.1:8765/stickerwall.html"
& $python "local_portrait\server.py"
