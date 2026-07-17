@echo off
rem Superviseur : relance le serveur LinguaLive automatiquement s'il s'arrete.
rem Lance en arriere-plan par lingualive-autostart.vbs — ne pas fermer.
cd /d "%~dp0"
:loop
node server.js >> server.log 2>> server-err.log
echo [%date% %time%] serveur arrete, relance dans 3 s... >> server-err.log
timeout /t 3 /nobreak >nul
goto loop
