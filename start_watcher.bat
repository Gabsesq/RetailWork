@echo off
cd /d "C:\Users\Gabby\OneDrive - Pet Releaf\Desktop\RetailWork\RetailWork"
echo Starting lot code watcher for Current Lot Code Data 2.xlsx at %date% %time% >> watcher_log.txt
python file_watcher.py
pause 