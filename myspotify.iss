; myspotify Inno Setup Script
; Creates a professional Windows installer
; Requirements: Inno Setup 6 (https://jrsoftware.org/isinfo.php)

#define MyAppName      "myspotify"
#define MyAppVersion   "2.5.2"
#define MyAppPublisher "tyg01132-netizen"
#define MyAppURL       "https://tyg01132-netizen.github.io/myspotify"
#define MyAppExeName   "start.vbs"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=
; No license file needed
OutputDir=dist
OutputBaseFilename=myspotify-setup-{#MyAppVersion}
SetupIconFile=static\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=110
MinVersion=10.0

; Request admin rights to modify hosts file
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "dutch";   MessagesFile: "compiler:Languages\Dutch.isl"

[Tasks]
Name: "desktopicon";    Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startupentry";   Description: "Start myspotify automatically with Windows"; GroupDescription: "Windows startup:"

[Files]
; App files
Source: "app.py";              DestDir: "{app}"; Flags: ignoreversion
Source: "requirements.txt";    DestDir: "{app}"; Flags: ignoreversion
Source: "start.vbs";           DestDir: "{app}"; Flags: ignoreversion
Source: "setup_hosts.bat";     DestDir: "{app}"; Flags: ignoreversion
Source: "static\*";            DestDir: "{app}\static";    Flags: ignoreversion recursesubdirs
Source: "templates\*";         DestDir: "{app}\templates"; Flags: ignoreversion recursesubdirs

; Python embed (you need to add this folder — see README_INSTALLER.md)
; Source: "python-embed\*"; DestDir: "{app}\python-embed"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\myspotify";           Filename: "{sys}\wscript.exe"; Parameters: """{app}\start.vbs"""; IconFilename: "{app}\static\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\myspotify";   Filename: "{sys}\wscript.exe"; Parameters: """{app}\start.vbs"""; IconFilename: "{app}\static\icon.ico"; Tasks: desktopicon

[Run]
; Install Python packages silently
Filename: "{cmd}"; Parameters: "/c python -m pip install flask requests --quiet"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; StatusMsg: "Installing Python packages..."
; Add to hosts file
Filename: "{cmd}"; Parameters: "/c echo 127.0.0.1 myspotify >> %SystemRoot%\System32\drivers\etc\hosts"; Flags: runhidden waituntilterminated; StatusMsg: "Configuring local URL..."
; Start the app after install
Filename: "{sys}\wscript.exe"; Parameters: """{app}\start.vbs"""; Flags: nowait postinstall skipifsilent; Description: "Launch myspotify now"

[Registry]
; Autostart with Windows (only if user chose the task)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "myspotify"; ValueData: """{sys}\wscript.exe"" ""{app}\start.vbs"""; Tasks: startupentry; Flags: uninsdeletevalue

[UninstallRun]
; Remove from hosts file on uninstall
Filename: "{cmd}"; Parameters: "/c powershell -Command ""(Get-Content '%SystemRoot%\System32\drivers\etc\hosts') | Where-Object {{ $_ -notmatch 'myspotify' }} | Set-Content '%SystemRoot%\System32\drivers\etc\hosts'"""; Flags: runhidden waituntilterminated

[Code]
// Check if Python is installed
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if not Exec('python', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if MsgBox('Python is not installed. myspotify needs Python to run.' + #13#10 + #13#10 +
              'Would you like to open python.org to download it?' + #13#10 +
              'After installing Python, run this installer again.',
              mbError, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://www.python.org/downloads/', '', '', SW_SHOW, ewNoWait, ResultCode);
    end;
    Result := False;
  end;
end;
