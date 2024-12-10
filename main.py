from flask import Flask, jsonify, send_from_directory
from openpyxl import load_workbook
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)

EXCEL_FILE_PATH = "Retail.xlsx"

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


@app.route("/", methods=["GET"])
def home():
    # Serve the static HTML file
    return send_from_directory(app.static_folder, "index.html")

@app.route("/load", methods=["GET"])
def load_data():
    try:
        data = load_excel_data()
        return jsonify({"status": "success", "data": data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == "__main__":
    app.run(debug=True)
