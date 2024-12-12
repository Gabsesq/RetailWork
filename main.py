from flask import Flask, jsonify, send_from_directory, request
from openpyxl import load_workbook
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)

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

@app.route("/", methods=["GET"])
def home():
    return send_from_directory(app.static_folder, "index.html")

@app.route('/get-lot-codes', methods=['GET'])
def get_lot_codes():
    try:
        wb = load_workbook('LotCode.xlsx')
        ws = wb.active
        
        lot_codes = {}
        sku_columns = []
        current_skus = {col: None for col in range(ws.max_column)}
        
        # Find all SKU columns from the header row
        header_row = next(ws.rows)
        for col_idx, cell in enumerate(header_row):
            if cell.value and 'SKU' in str(cell.value).upper():
                sku_columns.append(col_idx)
                print(f"Found SKU column at index {col_idx}")
                # Print the next few column headers for debugging
                for i in range(5):
                    if col_idx + i < len(header_row):
                        print(f"  Column {col_idx + i}: {header_row[col_idx + i].value}")
        
        # Process each row from row 5
        for row_idx, row in enumerate(ws.iter_rows(min_row=5), start=5):
            for col_idx in sku_columns:
                sku = row[col_idx].value
                lot_col_idx = col_idx + 1  # Lot column is next to SKU
                case_col_idx = col_idx + 2  # Case count column
                each_col_idx = col_idx + 3  # Each column
                bb_col_idx = col_idx + 4  # BB date is in the 5th column of each section
                
                if lot_col_idx < len(row) and bb_col_idx < len(row):
                    lot = row[lot_col_idx].value
                    bb_date = row[bb_col_idx].value
                    
                    # Debug prints for all columns in this section
                    if sku and 'TS-' in str(sku):
                        print(f"\nProcessing TS- SKU row {row_idx}:")
                        print(f"  SKU ({col_idx}): {sku}")
                        print(f"  Lot# ({lot_col_idx}): {lot}")
                        print(f"  Case ({case_col_idx}): {row[case_col_idx].value if case_col_idx < len(row) else 'N/A'}")
                        print(f"  Each ({each_col_idx}): {row[each_col_idx].value if each_col_idx < len(row) else 'N/A'}")
                        print(f"  BB Date ({bb_col_idx}): {bb_date}")
                        # Print next few cells for context
                        for i in range(6):
                            if col_idx + i < len(row):
                                print(f"  Column {col_idx + i}: {row[col_idx + i].value}")
                    
                    # Store the original SKU name without any case changes
                    if sku and str(sku).strip() != 'Total':
                        current_sku = str(sku).strip()
                        current_skus[col_idx] = current_sku
                        if current_sku not in lot_codes:
                            lot_codes[current_sku] = {}
                            print(f"Created new SKU entry: {current_sku}")
                    
                    elif sku and str(sku).strip() == 'Total':
                        if current_skus[col_idx] and 'TS-' in current_skus[col_idx]:
                            print(f"Hit Total for TS- SKU: {current_skus[col_idx]}")
                        current_skus[col_idx] = None
                        continue
                    
                    if lot and current_skus[col_idx] and str(lot).strip().lower() != 'total':
                        current_sku = current_skus[col_idx]
                        if bb_date:
                            bb_date_str = bb_date.strftime('%m/%d/%y')
                        else:
                            bb_date_str = ''
                        lot_codes[current_sku][str(lot)] = bb_date_str
                        if 'TS-' in current_sku:
                            print(f"Added lot code for TS- SKU {current_sku}: {lot} -> {bb_date_str}")

        print("\nFinal lot_codes structure for TS- SKUs:")
        for sku in sorted(lot_codes.keys()):
            if 'TS-' in sku:
                print(f"{sku}:")
                for lot, bb in lot_codes[sku].items():
                    print(f"  {lot}: {bb}")
        
        return jsonify({"status": "success", "data": lot_codes})
    except Exception as e:
        print("Error loading lot codes:", str(e))
        return jsonify({"status": "error", "message": str(e)})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)

