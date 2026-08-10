@echo off
REM ============================================================
REM  Iniciar Turnero - modo kiosco SIN necesidad de clicks
REM ------------------------------------------------------------
REM  Abre Chrome/Edge a pantalla completa con la politica de
REM  autoplay desactivada, para que la voz del turnero suene
REM  automaticamente sin que nadie toque la pantalla.
REM
REM  USO:
REM    iniciar-turnero.bat                        -> http://localhost/turnero/1 (sede 1)
REM    iniciar-turnero.bat http://192.168.1.50     -> otra IP / dominio (sede 1)
REM    iniciar-turnero.bat http://192.168.1.50 2   -> ademas selecciona sede 2
REM ============================================================

set "URL=%~1"
if "%URL%"=="" set "URL=http://localhost"

set "SEDE=%~2"
if "%SEDE%"=="" set "SEDE=1"

REM --- Asegurar que la URL termine en /turnero/<sede> ---
if not "%URL:~-8%"=="/turnero" (
  if "%URL:~-1%"=="/" ( set "URL=%URL%turnero" ) else ( set "URL=%URL%/turnero" )
)
set "URL=%URL%/%SEDE%?sala=aps"

REM --- Buscar Chrome ---
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

REM --- Buscar Edge como alternativa ---
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --no-first-run "%URL%"
  goto :fin
)

if exist "%EDGE%" (
  start "" "%EDGE%" --kiosk --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --no-first-run "%URL%"
  goto :fin
)

echo No se encontro Chrome ni Edge instalado en este equipo.
pause

:fin
endlocal
