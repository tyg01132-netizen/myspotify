' myspotify — silent background start
' Starts Flask server without showing any window
' Then opens browser automatically

Set oShell = CreateObject("WScript.Shell")
Set oFSO   = CreateObject("Scripting.FileSystemObject")

' Get the folder where this script lives
scriptDir = oFSO.GetParentFolderName(WScript.ScriptFullName)

' Check if a Python venv exists, use it — else fall back to system Python
venvPython = scriptDir & "\venv\Scripts\python.exe"
sysPython  = "python"

If oFSO.FileExists(venvPython) Then
    pythonExe = """" & venvPython & """"
Else
    pythonExe = sysPython
End If

appPy = """" & scriptDir & "\app.py"""

' Run silently (0 = hidden window, False = don't wait)
oShell.Run pythonExe & " " & appPy, 0, False

