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
        for col_idx, cell in enumerate(next(ws.rows)):
            if cell.value and 'SKU' in str(cell.value).upper():
                sku_columns.append(col_idx)
                print(f"Found SKU column at index {col_idx}")  # Debug print
        
        # Process each row from row 5
        for row_idx, row in enumerate(ws.iter_rows(min_row=5), start=5):
            for col_idx in sku_columns:
                sku = row[col_idx].value
                lot_col_idx = col_idx + 1
                bb_col_idx = col_idx + 4
                
                if lot_col_idx < len(row) and bb_col_idx < len(row):
                    lot = row[lot_col_idx].value
                    bb_date = row[bb_col_idx].value
                    
                    # Debug prints
                    if sku or lot:
                        print(f"Row {row_idx}, Col {col_idx}:")
                        print(f"  SKU: {sku}")
                        print(f"  Lot: {lot}")
                        print(f"  BB Date: {bb_date}")
                    
                    if sku and str(sku).strip() != 'Total':
                        current_sku = str(sku).strip()
                        current_skus[col_idx] = current_sku
                        if current_sku not in lot_codes:
                            lot_codes[current_sku] = {}
                            print(f"Created new SKU entry: {current_sku}")  # Debug print
                    
                    elif sku and str(sku).strip() == 'Total':
                        current_skus[col_idx] = None
                    
                    if lot and current_skus[col_idx] and str(lot).strip().lower() != 'total':
                        current_sku = current_skus[col_idx]
                        if bb_date:
                            bb_date_str = bb_date.strftime('%m/%d/%y')
                        else:
                            bb_date_str = ''
                        lot_codes[current_sku][str(lot)] = bb_date_str
                        print(f"Added lot code for {current_sku}: {lot} -> {bb_date_str}")  # Debug print

        print("\nFinal lot_codes structure:")
        for sku, lots in lot_codes.items():
            print(f"{sku}:")
            for lot, bb in lots.items():
                print(f"  {lot}: {bb}")
        
        return jsonify({"status": "success", "data": lot_codes})
    except Exception as e:
        print("Error loading lot codes:", str(e))
        return jsonify({"status": "error", "message": str(e)})

if __name__ == "__main__":
    app.run(debug=True)

