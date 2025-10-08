Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appdir = fso.GetParentFolderName(WScript.ScriptFullName)
html = fso.BuildPath(appdir, "index.html")

candidates = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe" _
)

found = ""
For Each p In candidates
  If fso.FileExists(p) Then found = p : Exit For
Next

If found <> "" Then
  sh.Run """" & found & """ """ & html & """", 0, False
Else
  sh.Run """" & html & """", 0, False
End If
