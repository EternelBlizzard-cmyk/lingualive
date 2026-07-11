@echo off
rem Ouvre un tunnel HTTPS public vers LinguaLive (sans compte Cloudflare).
rem L'URL https://…trycloudflare.com s'affiche ci-dessous — ouvre-la sur ton téléphone.
rem NB : cette URL change à chaque lancement. Pour une URL fixe, voir MOBILE.md (tunnel nommé, compte gratuit).
echo.
echo  Tunnel LinguaLive — attends l'URL https://xxxx.trycloudflare.com ci-dessous...
echo  (garde cette fenetre ouverte tant que tu utilises l'appli sur le telephone)
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3100
