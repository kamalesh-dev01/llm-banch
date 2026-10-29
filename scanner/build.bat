@echo off
echo Building LLM Bench Scanner GUI...

set PYINSTALLER_CMD=pyinstaller
if exist "..\venv\Scripts\pyinstaller.exe" (
    set "PYINSTALLER_CMD=..\venv\Scripts\pyinstaller.exe"
)

%PYINSTALLER_CMD% --onefile --noconsole --name LLMBench-Scanner --icon assets\icon.ico --version-file version_info.txt --collect-all customtkinter scanner_gui.py
if %ERRORLEVEL% NEQ 0 (
    echo Build failed with error %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
echo.
echo Copying executable to backend\static...
copy /Y dist\LLMBench-Scanner.exe ..\backend\static\LLMBench-Scanner.exe
echo Build and copy completed successfully!
