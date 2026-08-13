@echo off
REM Double-click entry point. Hands off to run.ps1, which does the real work.
REM
REM Named "run" rather than "start" on purpose: `start` is a cmd.exe builtin,
REM so a start.cmd here would never be what you get by typing `start`.
REM
REM -ExecutionPolicy Bypass applies to this one process only; nothing about the
REM machine's policy is changed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
if errorlevel 1 pause
