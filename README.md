### RetailWork
Automating our retail scanner at work; eventually this will connect to QuickBooks.

### Lot code data flow (critical)
- **Source spreadsheet**: `LotCode.xlsx` in the project root is the current master file for lot codes and best-by dates.
- **Converter script**: `excel_to_json.py` reads from the Excel source and generates JSON lot data.
- **Generated outputs** (do not edit by hand):
  - `static/js/lot_codes.json`
  - `public/js/lot_codes.json`
- **Site usage**: `lots.html` and other pages read from `public/js/lot_codes.json` to power the lot-code lookups.

### How the automatic updates run
- **Primary scheduled job**:
  - Windows Task Scheduler task: `LotCodeAutoUpdate`
  - Calls: `scheduled_lot_update.ps1`
  - Working directory: project root (`RetailWork`)
  - Script steps:
    1. Run `python excel_to_json.py` to regenerate the JSON files.
    2. If the script succeeds, run `git add .` and `git commit -m "Auto-update lot codes - <timestamp>"`.
    3. Push changes to GitHub: `origin main` and `origin vercel --force`.
- **Manual run (for testing)**:
  1. Open PowerShell.
  2. `cd "C:\Users\GabbyEsquibel\OneDrive - Pet Releaf\Desktop\RetailWork\RetailWork"`
  3. Run `.\scheduled_lot_update.ps1` and watch for errors.

### Other helper scripts
- **`start_scheduler.bat` / `scheduler.py`**: Alternate Python-based scheduler that runs `excel_to_json.py` every 30 minutes in a long‑running console window (not used when Task Scheduler is enabled).
- **`file_watcher.py` / `start_watcher.bat`**: Watches a lot-code Excel file for changes and, on modify, calls `convert_excel_to_json()` and pushes changes (used for interactive/testing workflows).

### Common failure modes and fixes
- **Excel permission error**: If `excel_to_json.py` logs `PermissionError` for the Excel file, close the workbook everywhere (and make sure OneDrive isn’t locking it), then rerun.
- **Git `index.lock` error**: If scripts log `Unable to create .../.git/index.lock`, delete the stale lock and retry:
  - In PowerShell:  
    `cd "C:\Users\GabbyEsquibel\OneDrive - Pet Releaf\Desktop\RetailWork\RetailWork"`  
    `Remove-Item -Force ".git\index.lock"`
- **“JSON looks wrong”**: If `lot_codes.json` suddenly fills with formulas or dates instead of real SKUs, restore it from git (`git restore static/js/lot_codes.json public/js/lot_codes.json`), then fix the Excel layout or column mappings in `excel_to_json.py` before re-running.