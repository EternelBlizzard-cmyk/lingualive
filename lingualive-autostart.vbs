' Démarre LinguaLive (serveur + tunnel mobile) en arrière-plan au démarrage de Windows.
' Une copie de ce fichier est placée dans le dossier Démarrage (shell:startup).
' Pour désactiver : supprimer cette copie.
Dim shell, serverDir
Set shell = CreateObject("WScript.Shell")
serverDir = "C:\Users\jeffr\OneDrive\Documents\Claude\Projects\LinguaLive"

' Laisse OneDrive monter le dossier avant de lancer quoi que ce soit
WScript.Sleep 45000

shell.CurrentDirectory = serverDir
' Le superviseur relance le serveur automatiquement s'il s'arrete
shell.Run "cmd /c """ & serverDir & "\server-loop.bat""", 0, False

' Tunnel mobile supervisé : l'URL du moment est visible dans l'appli (Réglages > Sur le téléphone)
WScript.Sleep 5000
shell.Run "cmd /c """ & serverDir & "\tunnel-loop.bat""", 0, False
