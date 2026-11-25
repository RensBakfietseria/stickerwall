@echo off
setlocal
cd /d "%~dp0"
if not exist ".local-portrait-venv\Scripts\python.exe" (
  echo Installeer Stickerwall eerst met local_portrait\setup.ps1.
  exit /b 1
)
".local-portrait-venv\Scripts\python.exe" "local_portrait\update.py"
exit /b %ERRORLEVEL%
