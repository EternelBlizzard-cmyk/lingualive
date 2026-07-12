' Démarre LinguaLive (serveur + tunnel mobile) en arrière-plan au démarrage de Windows.
' Une copie de ce fichier est placée dans le dossier Démarrage (shell:startup).
' Pour désactiver : supprimer cette copie.
Dim shell, serverDir
Set shell = CreateObject("WScript.Shell")
serverDir = "C:\Users\jeffr\OneDrive\Documents\Claude\Projects\Edutrust\lingualive"

' Laisse OneDrive monter le dossier avant de lancer quoi que ce soit
WScript.Sleep 45000

shell.CurrentDirectory = serverDir
shell.Run "cmd /c node """ & serverDir & "\server.js""", 0, False

' Tunnel mobile : l'URL du moment est visible dans l'appli (Réglages > Sur le téléphone)
WScript.Sleep 5000
shell.Run "cmd /c ""C:\Program Files (x86)\cloudflared\cloudflared.exe"" tunnel --url http://localhost:3100 --logfile """ & serverDir & "\tunnel.log""", 0, False
