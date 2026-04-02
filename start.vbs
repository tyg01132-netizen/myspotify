' myspotify — single-instance silent launcher
Option Explicit

Dim oShell, oFSO, scriptDir, venvPython, appPy, pythonExe
Dim oHTTP, alreadyRunning, statusCode

Set oShell = CreateObject("WScript.Shell")
Set oFSO   = CreateObject("Scripting.FileSystemObject")

scriptDir  = oFSO.GetParentFolderName(WScript.ScriptFullName)
venvPython = scriptDir & "\venv\Scripts\python.exe"
appPy      = scriptDir & "\app.py"

' Test if server already listening on port 5001
alreadyRunning = False
On Error Resume Next
Set oHTTP = CreateObject("MSXML2.ServerXMLHTTP")
oHTTP.Open "GET", "http://127.0.0.1:5001/", False
oHTTP.setTimeouts 500, 500, 500, 500
oHTTP.Send
If Err.Number = 0 Then
    If oHTTP.Status >= 200 And oHTTP.Status < 500 Then
        alreadyRunning = True
    End If
End If
On Error GoTo 0

If alreadyRunning Then
    ' Server running — just open browser tab
    oShell.Run "cmd /c start http://127.0.0.1:5001", 0, False
Else
    ' Start Flask server silently
    If oFSO.FileExists(venvPython) Then
        pythonExe = Chr(34) & venvPython & Chr(34)
    Else
        pythonExe = "python"
    End If
    oShell.Run pythonExe & " " & Chr(34) & appPy & Chr(34), 0, False
    ' Wait for Flask to start
    WScript.Sleep 2000
    ' Open browser exactly once
    oShell.Run "cmd /c start http://127.0.0.1:5001", 0, False
End If
