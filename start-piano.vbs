Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' 프로젝트 경로
Dim projectPath
projectPath = "E:\OneDrive\Development\Claude_Code_Project\Piano-learning"

' 터미널 창 없이 실행 (0 = 숨김)
WshShell.Run "cmd /c cd /d """ & projectPath & """ && npm run electron:dev", 0, False

Set WshShell = Nothing
