import json
from openpyxl import load_workbook
import os
from datetime import datetime, timedelta

def process_block(ws, lot_codes, sku_col, lot_col, bb_col, start_row=3):
    row = start_row
    empty_count = 0
    while empty_count < 6:
        sku = ws.cell(row=row, column=sku_col).value
        if sku and str(sku).strip().lower() not in ["", "total"]:
            sku = str(sku).strip()
            print(f"Found SKU: {sku} at row {row} (col {sku_col})")
            lot_codes[sku] = {}
            lot_row = row
            # Skip blank cells in lot_col after SKU
            while True:
                lot = ws.cell(row=lot_row, column=lot_col).value
                if lot and str(lot).strip().lower() not in ["", "total"]:
                    break
                if not lot or str(lot).strip().lower() == "total":
                    print(f"Hit 'Total' or empty at row {lot_row} for SKU {sku} (no lots found)")
                    lot_row += 1
                    break
                lot_row += 1
            # Now process lots as before
            while True:
                lot = ws.cell(row=lot_row, column=lot_col).value
                if not lot or str(lot).strip().lower() == "total":
                    print(f"Hit 'Total' or empty at row {lot_row} for SKU {sku}")
                    lot_row += 1  # Move past the 'Total' row
                    break
                lot = str(lot).strip()
                bb = ws.cell(row=lot_row, column=bb_col).value
                if bb:
                    # Debug: print the type and value to understand what we're dealing with
                    print(f"    DEBUG: BB value type: {type(bb)}, value: {bb}")
                    
                    # Handle different data types more robustly
                    if hasattr(bb, 'strftime'):  # It's a datetime object
                        bb_str = bb.strftime('%Y-%m-%d')
                    elif isinstance(bb, (int, float)):  # It's a number (Excel date serial)
                        # Convert Excel date serial to string
                        try:
                            excel_epoch = datetime(1900, 1, 1)
                            date_obj = excel_epoch + timedelta(days=bb-2)  # -2 for Excel's leap year bug
                            bb_str = date_obj.strftime('%Y-%m-%d')
                        except:
                            bb_str = str(bb)
                    else:
                        # Try to convert to string, but handle potential issues
                        try:
                            bb_str = str(bb)
                            # If it contains time (00:00:00), remove it
                            if " 00:00:00" in bb_str:
                                bb_str = bb_str.replace(" 00:00:00", "")
                        except:
                            bb_str = f"Error: {type(bb).__name__}"
                else:
                    bb_str = ""
                
                # Store lot info with BB date
                lot_info = {
                    "bb_date": bb_str
                }
                
                print(f"  Adding lot {lot} with BB date {bb_str}")
                lot_codes[sku][lot] = lot_info
                lot_row += 1
            row = lot_row  # Move to the row after "Total"
            empty_count = 0  # Reset empty counter after finding a SKU
        else:
            row += 1
            empty_cell = ws.cell(row=row, column=sku_col).value
            if not empty_cell or str(empty_cell).strip() == "":
                empty_count += 1
                print(f"  Empty cell at row {row}, empty_count={empty_count}")
            else:
                empty_count = 0


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
    """Compare existing and new data, print new lots"""
    print("\n" + "="*60)
    print("NEW LOTS DETECTED:")
    print("="*60)
    
    new_lots_found = False
    
    for sku, lots in new_data.items():
        if sku not in existing_data:
            print(f"\n🆕 NEW SKU: {sku}")
            for lot, lot_info in lots.items():
                bb_date = lot_info.get("bb_date", "") if isinstance(lot_info, dict) else str(lot_info)
                print(f"  📦 New lot: {lot} (BB: {bb_date})")
            new_lots_found = True
        else:
            # Check for new lots in existing SKU
            new_lots_for_sku = []
            for lot, lot_info in lots.items():
                if lot not in existing_data[sku]:
                    new_lots_for_sku.append((lot, lot_info))
            
            if new_lots_for_sku:
                print(f"\n📦 NEW LOTS for existing SKU: {sku}")
                for lot, lot_info in new_lots_for_sku:
                    bb_date = lot_info.get("bb_date", "") if isinstance(lot_info, dict) else str(lot_info)
                    print(f"  📦 New lot: {lot} (BB: {bb_date})")
                new_lots_found = True
    
    if not new_lots_found:
        print("✅ No new lots detected - all data is up to date!")
    
    print("="*60)





def convert_excel_to_json():
    excel_path = r"C:\Users\GabbyEsquibel\Pet Releaf\Warehouse - Documents\Current Lot Code Data.xlsx"  # Use local file for testing
    wb = load_workbook(excel_path)
    ws = wb.active

    # Load existing data first
    existing_data = load_existing_json()
    
    lot_codes = {}
    # First block: A-F (1-6)
    process_block(ws, lot_codes, sku_col=1, lot_col=2, bb_col=6, start_row=3)
    # Second block: I-N (9-14)
    process_block(ws, lot_codes, sku_col=9, lot_col=10, bb_col=14, start_row=3)
    # Third block: Q-V (17-22)
    process_block(ws, lot_codes, sku_col=17, lot_col=18, bb_col=22, start_row=3)
    # Fourth block: Y-AD (25-30)
    process_block(ws, lot_codes, sku_col=25, lot_col=26, bb_col=30, start_row=3)

    print("Finished processing all SKUs in all blocks.")
    
    # Compare and print new lots
    compare_and_print_new_lots(existing_data, lot_codes)
    
    # Save the new data
    with open('static/js/lot_codes.json', 'w') as f:
        json.dump(lot_codes, f, indent=2)
    with open('public/js/lot_codes.json', 'w') as f:
        json.dump(lot_codes, f, indent=2)
    
    print(f"\n💾 Saved updated lot codes to JSON files")

if __name__ == "__main__":
    convert_excel_to_json() 