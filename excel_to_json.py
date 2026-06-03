import json
from openpyxl import load_workbook
import os
from datetime import datetime, timedelta

EXCEL_PATH = r"C:\Users\GabbyEsquibel\Pet Releaf\Warehouse - Documents\NEW WH Locations 2026.xlsx"
SHEET_NAME = "Master Location List"
SKU_COL = 9   # Column I
LOT_COL = 13  # Column M
BB_COL = 14   # Column N


def format_bb_date(bb):
    """Normalize Excel best-by values to YYYY-MM-DD strings."""
    if not bb:
        return ""

    if isinstance(bb, datetime):
        return bb.strftime('%Y-%m-%d')

    if hasattr(bb, 'strftime') and not isinstance(bb, datetime):
        # Excel sometimes stores midnight-only values as time objects.
        return ""

    if isinstance(bb, (int, float)):
        try:
            excel_epoch = datetime(1900, 1, 1)
            date_obj = excel_epoch + timedelta(days=bb - 2)
            return date_obj.strftime('%Y-%m-%d')
        except (ValueError, OverflowError):
            return str(bb)

    bb_str = str(bb)
    if " 00:00:00" in bb_str:
        bb_str = bb_str.replace(" 00:00:00", "")
    return bb_str


def process_warehouse_locations(ws, lot_codes, start_row=2):
    """Read warehouse lot rows from Master Location List (SKU/Lot/BB columns)."""
    for row in range(start_row, ws.max_row + 1):
        sku = ws.cell(row=row, column=SKU_COL).value
        lot = ws.cell(row=row, column=LOT_COL).value

        if not sku or str(sku).strip().lower() in ("", "sku"):
            continue

        sku = str(sku).strip()
        if not lot or str(lot).strip().lower() in ("", "lot #"):
            continue

        lot = str(lot).strip()
        bb_str = format_bb_date(ws.cell(row=row, column=BB_COL).value)

        if sku not in lot_codes:
            lot_codes[sku] = {}

        if lot not in lot_codes[sku]:
            lot_codes[sku][lot] = {"bb_date": bb_str}
            print(f"  Adding lot {lot} for {sku} (BB: {bb_str})")


def load_existing_json():
    """Load existing JSON file if it exists"""
    json_paths = ['static/js/lot_codes.json', 'public/js/lot_codes.json']
    existing_data = {}
    
    for path in json_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    existing_data = json.load(f)
                print(f"Loaded existing data from {path}")
                break
            except (json.JSONDecodeError, FileNotFoundError):
                print(f"Could not load existing data from {path}")
                continue
    
    return existing_data


def compare_and_print_new_lots(existing_data, new_data):
    """Compare existing and new data, print new lots and save to Excel"""
    print("\n" + "="*60)
    print("NEW LOTS DETECTED:")
    print("="*60)
    
    new_lots_found = False
    all_new_lots = []  # Store all new lots for Excel export
    
    for sku, lots in new_data.items():
        if sku not in existing_data:
            print(f"\nNEW SKU: {sku}")
            for lot, lot_info in lots.items():
                bb_date = lot_info.get("bb_date", "") if isinstance(lot_info, dict) else str(lot_info)
                print(f"  New lot: {lot} (BB: {bb_date})")
                all_new_lots.append({
                    'SKU': sku,
                    'Lot Code': lot,
                    'Best By Date': bb_date,
                    'Type': 'New SKU'
                })
            new_lots_found = True
        else:
            # Check for new lots in existing SKU
            new_lots_for_sku = []
            for lot, lot_info in lots.items():
                if lot not in existing_data[sku]:
                    new_lots_for_sku.append((lot, lot_info))
            
            if new_lots_for_sku:
                print(f"\nNEW LOTS for existing SKU: {sku}")
                for lot, lot_info in new_lots_for_sku:
                    bb_date = lot_info.get("bb_date", "") if isinstance(lot_info, dict) else str(lot_info)
                    print(f"  New lot: {lot} (BB: {bb_date})")
                    all_new_lots.append({
                        'SKU': sku,
                        'Lot Code': lot,
                        'Best By Date': bb_date,
                        'Type': 'New Lot'
                    })
                new_lots_found = True
    
    if not new_lots_found:
        print("No new lots detected - all data is up to date!")
    else:
        # Save new lots to Excel file
        try:
            from openpyxl import load_workbook
            from openpyxl import Workbook
            desktop_path = r"C:\Users\GabbyEsquibel\OneDrive - Pet Releaf\Desktop\newLots.xlsx"
            
            # Try to load existing file, create new one if it doesn't exist
            try:
                wb = load_workbook(desktop_path)
                ws = wb.active
                print("Loaded existing newLots.xlsx file")
            except FileNotFoundError:
                wb = Workbook()
                ws = wb.active
                ws.title = "New Lots Detected"
                # Add headers for new file
                headers = ['SKU', 'Lot Code', 'Best By Date', 'Type', 'Detection Date']
                for col, header in enumerate(headers, 1):
                    ws.cell(row=1, column=col, value=header)
                print("Created new newLots.xlsx file")
            
            # Find the next empty row
            next_row = ws.max_row + 1
            
            # Add new lots data
            detection_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            for lot_data in all_new_lots:
                ws.cell(row=next_row, column=1, value=lot_data['SKU'])
                ws.cell(row=next_row, column=2, value=lot_data['Lot Code'])
                ws.cell(row=next_row, column=3, value=lot_data['Best By Date'])
                ws.cell(row=next_row, column=4, value=lot_data['Type'])
                ws.cell(row=next_row, column=5, value=detection_date)
                next_row += 1
            
            # Save the updated file
            wb.save(desktop_path)
            print(f"Added {len(all_new_lots)} new lots to existing file: {desktop_path}")
            
        except Exception as e:
            print(f"Could not update newLots.xlsx: {e}")
    
    print("="*60)





def convert_excel_to_json():
    wb = load_workbook(EXCEL_PATH, data_only=True)
    if SHEET_NAME not in wb.sheetnames:
        raise ValueError(f"Sheet '{SHEET_NAME}' not found in {EXCEL_PATH}")

    ws = wb[SHEET_NAME]

    # Load existing data first
    existing_data = load_existing_json()
    
    lot_codes = {}
    print(f"Reading warehouse lots from '{SHEET_NAME}'...")
    process_warehouse_locations(ws, lot_codes)

    print(f"Finished processing warehouse lots ({len(lot_codes)} SKUs).")
    
    # Compare and print new lots
    compare_and_print_new_lots(existing_data, lot_codes)
    
    # Save the new data
    with open('static/js/lot_codes.json', 'w') as f:
        json.dump(lot_codes, f, indent=2)
    with open('public/js/lot_codes.json', 'w') as f:
        json.dump(lot_codes, f, indent=2)
    
    # Trigger deployment by adding a space to main HTML file
    try:
        with open('public/index.html', 'r') as f:
            content = f.read()
        
        # Add a space at the end if it doesn't already have one
        if not content.endswith(' '):
            content += ' '
            
        with open('public/index.html', 'w') as f:
            f.write(content)
        print("Added deployment trigger to index.html")
    except Exception as e:
        print(f"Could not update index.html: {e}")
    
    print("\nSaved updated lot codes to JSON files")

if __name__ == "__main__":
    convert_excel_to_json() 