@echo off
rem Superviseur du tunnel mobile : le relance automatiquement s'il tombe.
rem NB : l'URL trycloudflare change a chaque relance — la retrouver dans
rem l'appli (Reglages > Sur le telephone) ou via start-tunnel.bat.
cd /d "%~dp0"
:loop
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3100 --logfile "%~dp0tunnel.log"
timeout /t 5 /nobreak >nul
goto loop
