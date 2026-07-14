@echo off
REM Backup automático de BD PostgreSQL
REM Uso: backup.bat [output_dir]
REM Requiere: pg_dump en PATH, .env con DB_* configurado

setlocal enabledelayedexpansion

set OUTPUT_DIR=%~1
if "%OUTPUT_DIR%"=="" set OUTPUT_DIR=.\backups
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

set TIMESTAMP=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

set DB_HOST=%DB_HOST%
set DB_PORT=%DB_PORT%
set DB_USER=%DB_USER%
set DB_PASSWORD=%DB_PASSWORD%
set DB_NAME=%DB_NAME%

if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=5432
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_PASSWORD%"=="" (
    echo ERROR: DB_PASSWORD no configurada. Carga .env primero.
    exit /b 1
)
if "%DB_NAME%"=="" set DB_NAME=clinica_colas

set BACKUP_FILE=%OUTPUT_DIR%\backup_%DB_NAME%_%TIMESTAMP%.sql

echo [%DATE% %TIME%] Iniciando backup de %DB_NAME%...
pg_dump --host=%DB_HOST% --port=%DB_PORT% --username=%DB_USER% --no-password --format=custom --file="%BACKUP_FILE%" "%DB_NAME%"
if %errorlevel% equ 0 (
    echo [%DATE% %TIME%] Backup completado: %BACKUP_FILE%
    echo %BACKUP_FILE% >> "%OUTPUT_DIR%\.last_backup"
) else (
    echo [%DATE% %TIME%] ERROR: Backup fallo con codigo %errorlevel%
    exit /b %errorlevel%
)

REM Limpiar backups mas antiguos de 30 dias
forfiles /p "%OUTPUT_DIR%" /m backup_*.sql /d -30 /c "cmd /c del @path" 2>nul
