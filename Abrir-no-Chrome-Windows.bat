@echo off
setlocal
REM Abrir no Google Chrome (Windows)
set "APP_DIR=%~dp0"
set "HTML=%APP_DIR%index.html"

set "C1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "C2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "C3=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist "%C1%" set "CHROME=%C1%"
if exist "%C2%" set "CHROME=%C2%"
if exist "%C3%" set "CHROME=%C3%"

if defined CHROME (
  start "" "%CHROME%" "%HTML%"
  exit /b
)

REM Se não achar o Chrome, abre com o navegador padrão do Windows
start "" "%HTML%"
echo Nao encontrei o Google Chrome neste computador.
echo Instale o Chrome ou defina o Chrome como navegador padrao.
pause
