@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (
    where python >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo Python was not found. Install Python 3.8 or newer, then run this launcher again.
    echo Download Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating the project environment...
    %PYTHON_CMD% -m venv .venv
    if errorlevel 1 goto :error
)

echo Installing project requirements...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :error

echo Starting Script Rehearser...
".venv\Scripts\python.exe" app.py
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo The launcher encountered an error. Check the message above.
pause
exit /b 1
