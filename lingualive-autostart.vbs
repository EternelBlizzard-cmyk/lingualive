' Démarre le serveur LinguaLive en arrière-plan (sans fenêtre) au démarrage de Windows.
' Une copie de ce fichier est placée dans le dossier Démarrage de Windows.
' Pour désactiver : supprimer la copie dans shell:startup
Dim shell, serverDir
Set shell = CreateObject("WScript.Shell")
serverDir = "C:\Users\jeffr\OneDrive\Documents\Claude\Projects\Edutrust\lingualive"
shell.CurrentDirectory = serverDir
shell.Run "cmd /c node """ & serverDir & "\server.js""", 0, False
