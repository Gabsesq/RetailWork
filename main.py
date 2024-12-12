from flask import Flask, jsonify, send_from_directory, request
from openpyxl import load_workbook
from flask_cors import CORS
from threading import Timer
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os

app = Flask(__name__, static_folder='static')
CORS(app)

EXCEL_FILE_PATH = "Retail.xlsx"
debounce_timer = None
DEBOUNCE_DELAY = 1.0  # seconds

# SKU mapping
SKUMAP = {
    "860009592568": "Post-Bio-GH",
    "860009592551": "Omega-Alg",
    "850016364982": "Edi-DR-BC-SML",
    "864178000275": "Edi-DR-BC-LRG",
    "850016364968": "TS-Edi-HJ-PB",
    "850016364876": "Edi-HJ-PB-SML",
    "850016364883": "Edi-HJ-PB-LRG",
    "850016364890": "Edi-HJ-PB-FAM",
    "850016364951": "TS-Edi-STRESS-PB",
    "850016364838": "Edi-STRESS-PB-SML",
    "850016364852": "Edi-STRESS-PB-LRG",
    "850016364869": "Edi-STRESS-PB-FAM",
    "850016364906": "Edi-DR-SP-SML",
    "850016364913": "Edi-DR-SP-LRG",
    "850016364944": "TS-Edi-STRESS-Pepp",
    "850016364845": "Edi-STRESS-Pepp-SML",
    "850016364821": "Edi-STRESS-Pepp-LRG",
    "860008203403": "100-DR-HO",
    "860008203410": "200-DR-HO",
    "860008203427": "500-DR-HO",
    "860008203434": "750-DR-HO",
    "860009592575": "150-Mini-Stress-HO",
    "860008203441": "300-SR-HO",
    "860008203458": "600-SR-HO",
    "860008203465": "300-HJR-HO",
    "860008203472": "600-HJR-HO",
    "860008221988": "180-CAT-SR",
    "860008876775": "100-Lipe-Ultra",
    "860008876768": "300-Lipe-Ultra",
    "860009592513": "600-Lipe-Ultra",
    "861109000304": "CAP450",
    "850016364586": "SNT30",
    "860009592537": "TS-Itchy-Dry-Shampoo",
    "860008876713": "Itchy & Dry-SK-CT",
    "860009592520": "Itchy-Dry-Shampoo-Gallon",
    "860008876720": "Sensitive-SK-CT",
    "860008876737": "Conditioner-SK-CT",
    "860009592544": "TS-2in1-Shampoo",
    "860008876744": "2in1-SK-CT",
    "860008221971": "SK-PW-RL",
}

def load_excel_data():
    workbook = load_workbook(EXCEL_FILE_PATH)
    sheet = workbook.active
    data = []

    # Map merged cells to their metadata
    merged_cells_map = {}
    for merged_range in sheet.merged_cells.ranges:
        top_left_cell = merged_range.start_cell
        value = sheet[top_left_cell.coordinate].value
        merged_cells_map[(top_left_cell.row, top_left_cell.column)] = {
            "value": value,
            "colspan": merged_range.size["columns"],
            "rowspan": merged_range.size["rows"],
        }

    # Read data while skipping cells covered by merges
    for row_index, row in enumerate(sheet.iter_rows(values_only=False), start=1):
        row_data = []
        for col_index, cell in enumerate(row, start=1):
            if (row_index, col_index) in merged_cells_map:
                # Add the master cell data
                row_data.append(merged_cells_map[(row_index, col_index)])
            elif any(
                (row_index >= merged_range.min_row and row_index <= merged_range.max_row and
                 col_index >= merged_range.min_col and col_index <= merged_range.max_col)
                for merged_range in sheet.merged_cells.ranges
            ):
                # Skip cells covered by a merge
                row_data.append(None)
            else:
                # Add regular cell data
                row_data.append({"value": cell.value if cell.value is not None else ""})
        data.append(row_data)

    return data

def process_file_update():
    print("Processing file update...")
    try:
        workbook = load_workbook(EXCEL_FILE_PATH)
        sheet = workbook.active

        for row in range(4, 30):
            cell_value = sheet[f"A{row}"].value

            if (
                cell_value
                and isinstance(cell_value, str)
                and cell_value.isdigit()
                and cell_value.startswith("8")
                and len(cell_value) == 12
            ):
                print(f"Detected 12-digit UPC starting with '8': {cell_value}")

                if cell_value in SKUMAP:
                    sku = SKUMAP[cell_value]
                    print(f"Mapped SKU for {cell_value}: {sku}")
                    sheet[f"G{row}"].value = sku

        workbook.save(EXCEL_FILE_PATH)
        print("File update processed and saved.")
    except Exception as e:
        print(f"Error processing file update: {e}")

class ExcelChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        global debounce_timer

        if event.src_path.endswith(EXCEL_FILE_PATH):
            print(f"Detected changes in {EXCEL_FILE_PATH}")

            if debounce_timer:
                debounce_timer.cancel()

            debounce_timer = Timer(DEBOUNCE_DELAY, process_file_update)
            debounce_timer.start()

@app.route("/", methods=["GET"])
def home():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/load", methods=["GET"])
def load_data():
    try:
        data = load_excel_data()
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/get-lot-codes', methods=['GET'])
def get_lot_codes():
    try:
        wb = load_workbook('LotCode.xlsx')
        ws = wb.active
        
        lot_codes = {}
        sku_columns = []  # Will store column indices that contain SKUs
        current_sku = None
        
        # Find all SKU columns from the header row
        for col_idx, cell in enumerate(next(ws.rows)):
            if cell.value and 'SKU' in str(cell.value).upper():
                sku_columns.append(col_idx)
        
        print(f"Found SKU columns at indices: {sku_columns}")  # Debug print
        
        # Process each row starting from row 5
        for row in ws.iter_rows(min_row=5):
            # Check each SKU column in this row
            for col_idx in sku_columns:
                sku = row[col_idx].value
                lot_col_idx = col_idx + 1  # Lot column is next to SKU column
                
                if lot_col_idx < len(row):  # Make sure lot column exists
                    lot = row[lot_col_idx].value
                    
                    # Skip empty rows or rows without SKU/lot
                    if not sku and not lot:
                        continue
                    
                    # If we have a SKU (not empty and not 'Total')
                    if sku and str(sku).strip() != 'Total':
                        current_sku = str(sku).strip()
                        # Normalize SKU name to match SKUMAP values
                        if current_sku.lower().startswith('ts-'):
                            current_sku = current_sku[3:]  # Remove 'TS-' prefix
                        if current_sku not in lot_codes:
                            lot_codes[current_sku] = []
                        if lot and str(lot).strip().lower() != 'total':
                            lot_codes[current_sku].append(str(lot))
                    # If we have a lot number but no SKU (continuing previous SKU)
                    elif not sku and lot and current_sku:
                        if str(lot).strip().lower() != 'total':
                            lot_codes[current_sku].append(str(lot))
                    # If we hit 'Total', reset current_sku for this column
                    elif sku and str(sku).strip() == 'Total':
                        current_sku = None

        print("Loaded lot codes:", lot_codes)  # Debug print
        return jsonify({"status": "success", "data": lot_codes})
    except Exception as e:
        print("Error loading lot codes:", str(e))  # Debug print
        return jsonify({"status": "error", "message": str(e)})

if __name__ == "__main__":
    if not os.path.isfile(EXCEL_FILE_PATH):
        raise FileNotFoundError(f"The specified file '{EXCEL_FILE_PATH}' does not exist.")
    
    observer = Observer()
    event_handler = ExcelChangeHandler()
    observer.schedule(event_handler, path=os.getcwd(), recursive=False)
    observer.start()

    try:
        app.run(debug=True, use_reloader=False)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

