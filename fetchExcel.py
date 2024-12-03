import os
import pandas as pd

# File path to the local Excel file
EXCEL_FILE_PATH = r"Current Lot Code Data 2.xlsx"


def read_excel_file(file_path):
    """
    Read and normalize the Excel file once to reduce redundant processing.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file at {file_path} does not exist.")
    
    # Read the file
    excel_data = pd.read_excel(file_path)

    # Normalize relevant columns (convert all to string, strip whitespace, lowercase)
    excel_data = excel_data.applymap(lambda x: str(x).strip().lower() if not pd.isna(x) else x)

    return excel_data


def preprocess_excel_data():
    """
    Pre-read and normalize all relevant Excel data columns once.
    """
    excel_data = read_excel_file(EXCEL_FILE_PATH)
    normalized_data = {
        "sku_columns": [excel_data.iloc[:, i].tolist() for i in [0, 7, 14, 21]],
        "lot_code_columns": [excel_data.iloc[:, i].tolist() for i in [1, 8, 15, 22]],
    }
    return normalized_data


def fetch_lot_codes(sku):
    """
    Fetch lot codes for a given SKU after normalizing the data upfront.
    """
    excel_data = read_excel_file(EXCEL_FILE_PATH)

    # Convert the SKU to lowercase for comparison
    sku_lower = sku.lower()
    sku_columns = [0, 7, 14, 21]  # Columns to search

    lot_codes = []
    for column_index in sku_columns:
        if column_index >= len(excel_data.columns):
            continue

        # Locate the matching SKU
        matching_row = excel_data.loc[excel_data.iloc[:, column_index] == sku_lower]
        if matching_row.empty:
            continue

        row_index = matching_row.index[0]
        lot_column_index = column_index + 1

        # Traverse downward to fetch lot codes
        while row_index < len(excel_data):
            lot_value = excel_data.iloc[row_index, lot_column_index]
            if isinstance(lot_value, str) and lot_value == "total":
                break
            if pd.notna(lot_value):
                lot_codes.append(lot_value.strip())
            row_index += 1

    return lot_codes


def fetch_lot_details(lot_code):
    """
    Fetch expiration details for a specific lot code.
    """
    excel_data = read_excel_file(EXCEL_FILE_PATH)

    # Ensure all columns are treated as strings for comparison
    excel_data = excel_data.applymap(lambda x: str(x).strip() if not pd.isna(x) else x)

    # List of numeric indices for Lot # columns
    lot_code_columns = [1, 8, 15, 22]  # Adjacent to A, H, O, V

    # Iterate over each column to locate the Lot #
    for lot_column_index in lot_code_columns:
        if lot_column_index >= len(excel_data.columns):
            print(f"Column index {lot_column_index} is out of range.")
            continue

        # Locate the matching row for the lot code
        matching_row = excel_data.loc[excel_data.iloc[:, lot_column_index] == lot_code]
        if matching_row.empty:
            continue

        # Fetch expiration date, 3 cells to the right of the lot column
        expiration_date_column_index = lot_column_index + 3
        if expiration_date_column_index >= len(excel_data.columns):
            print(f"Column index {expiration_date_column_index} is out of range for expiration date.")
            return None

        # Try to fetch the expiration date
        expiration_date = matching_row.iloc[0, expiration_date_column_index]

        # Ensure only valid date values are returned
        try:
            expiration_date = pd.to_datetime(expiration_date).strftime('%Y-%m-%d')
        except (ValueError, TypeError):
            print(f"Invalid date format for Lot Code '{lot_code}' in column index {expiration_date_column_index}: {expiration_date}")
            expiration_date = None

        return expiration_date

    print(f"Lot code '{lot_code}' not found in the Excel file.")
    return None
