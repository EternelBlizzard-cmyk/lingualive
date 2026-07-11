@echo off
rem Lance LinguaLive et ouvre le navigateur — double-clique sur ce fichier
cd /d "%~dp0"
start "" "http://localhost:3100"
node server.js
