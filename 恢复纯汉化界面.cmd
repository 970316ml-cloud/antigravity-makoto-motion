@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Theme.ps1" -Restore
if errorlevel 1 pause
