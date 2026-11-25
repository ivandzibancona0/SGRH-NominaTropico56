' ====================================================================
' SGRH - Tropico 56 | Lanzador Silencioso (Sin ventana de consola)
' ====================================================================
Option Explicit

Dim fso, shell, scriptDir, psScript, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = fso.BuildPath(scriptDir, "launch-app.ps1")

If Not fso.FileExists(psScript) Then
    MsgBox "No se encontro el archivo launch-app.ps1 en la carpeta del proyecto.", vbCritical, "SGRH - Tropico 56"
    WScript.Quit 1
End If

' 0 = Ventana completamente oculta, False = No bloquear wscript
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psScript & """"
shell.Run cmd, 0, False
