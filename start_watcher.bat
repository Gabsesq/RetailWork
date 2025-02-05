@echo off
echo Starting lot code watcher...
cd /d %~dp0
python file_watcher.py
pause 