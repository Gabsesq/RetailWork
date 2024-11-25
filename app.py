import time
import pandas as pd
import os
from SKU import SKUMAP  # Import the mapping
from ExcelSKU import EXCEL_SKU  # Import the Excel SKU mapping
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from tkinkterHelper import show_lot_code_popup

# File path to the local Excel file
EXCEL_FILE_PATH = r"Current Lot Code Data 2.xlsx"

# Google Sheets setup
SPREADSHEET_ID = "1MYUwuPTPNY7P_e1sBvzV1m-VDDlJq6mnrLy3tGM1Duw"
SHEET_NAME = "Sheet1"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
CREDENTIALS_FILE = "service_account.json"

# Authenticate and connect to Google Sheets
def connect_to_google_sheets():
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds).spreadsheets()

# Read a specific cell value from Google Sheets
def read_cell(spreadsheet_id, sheet_name, cell_range):
    service = connect_to_google_sheets()
    range_name = f"{sheet_name}!{cell_range}"
    result = service.values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
    values = result.get('values', [])
    return str(values[0][0]).strip() if values else None

# Write data to Google Sheets
def write_to_google_sheets(data, spreadsheet_id, sheet_name, start_cell):
    service = connect_to_google_sheets()
    body = {"values": [[data]] if isinstance(data, str) else data}  # Single value or 2D array
    service.values().update(
        spreadsheetId=spreadsheet_id,
        range=f"{sheet_name}!{start_cell}",
        valueInputOption="RAW",
        body=body
    ).execute()

# Read the local Excel file
def read_excel_file(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file at {file_path} does not exist.")
    return pd.read_excel(file_path)

# Fetch lot codes from Excel based on the Excel SKU
def fetch_lot_codes(sku):
    # Read the Excel file
    excel_data = read_excel_file(EXCEL_FILE_PATH)
    
    # Map Full SKU to Excel SKU
    excel_sku = EXCEL_SKU.get(sku)
    if not excel_sku:
        print(f"SKU '{sku}' not found in ExcelSKU mapping.")
        return []

    print(f"Searching for Excel SKU: '{excel_sku}'")

    # Locate the SKU column
    sku_column = next((col for col in excel_data.columns if "SKU" in col), None)
    if not sku_column:
        print("No SKU column found in the Excel file.")
        return []

    # Debug: Print all SKU values in the column
    print(f"SKU column values:\n{excel_data[sku_column].dropna().tolist()}")

    # Clean and normalize SKU column for comparison
    excel_data[sku_column] = excel_data[sku_column].astype(str).str.strip()

    # Find the row with the matching SKU
    matching_row = excel_data.loc[excel_data[sku_column] == excel_sku]
    if matching_row.empty:
        print(f"Excel SKU '{excel_sku}' not found in the Excel file.")
        return []

    # Debug: Print the matching row
    print(f"Matching row for '{excel_sku}':\n{matching_row}")

    # Get the cell to the right of the matching SKU
    row_index = matching_row.index[0]
    lot_column_index = excel_data.columns.get_loc(sku_column) + 1
    lot_codes = []

    # Traverse downward until encountering "Total"
    while row_index < len(excel_data):
        lot_value = excel_data.iloc[row_index, lot_column_index]

        # Debug: Print the lot value being checked
        print(f"Row: {row_index}, Lot Value: {lot_value} (Type: {type(lot_value)})")

        if isinstance(lot_value, str) and lot_value.strip() == "Total":
            print("Reached 'Total'. Stopping the scan.")
            break
        if pd.notna(lot_value):
            lot_codes.append(str(lot_value).strip())
        row_index += 1

    print(f"Lot codes for Excel SKU '{excel_sku}': {lot_codes}")
    return lot_codes

 # Fetch expiration date and inventory for the selected lot code
def fetch_lot_details(lot_code):
    # Read the Excel file
    excel_data = pd.read_excel(EXCEL_FILE_PATH)

    # Locate the Lot # column
    lot_column = next((col for col in excel_data.columns if "Lot" in col), None)
    if not lot_column:
        print("No Lot # column found in the Excel file.")
        return None, None

    # Locate the matching row
    matching_row = excel_data.loc[excel_data[lot_column] == int(lot_code)]
    if matching_row.empty:
        print(f"Lot code '{lot_code}' not found in the Excel file.")
        return None, None

    # Fetch expiration date and inventory count
    expiration_date = matching_row["BB Date"].iloc[0] if "BB Date" in matching_row.columns else None

    return expiration_date

def monitor_and_update():
    print("Scanning for 12-digit UPCs starting with '8' in A4:A27...")
    previous_values = {}

    while True:
        try:
            # Step 1: Read the range A4:A27
            service = connect_to_google_sheets()
            result = service.values().get(
                spreadsheetId=SPREADSHEET_ID, 
                range="Sheet1!A4:A27"
            ).execute()
            range_values = result.get('values', [])

            # Ensure the list is the correct length
            # Fill missing rows with None to avoid index errors
            while len(range_values) < 24:  # 24 rows from A4 to A27
                range_values.append([None])

            # Step 2: Flatten the range_values (2D array) into a list and enumerate rows
            for i, row in enumerate(range_values, start=4):  # Start at A4
                cell_value = row[0] if row else None
                cell_address = f"A{i}"

                # Check if the value has changed and is valid
                if cell_value and cell_address not in previous_values or previous_values[cell_address] != cell_value:
                    previous_values[cell_address] = cell_value
                    value_str = str(cell_value).strip()

                    # Check if the value is a valid 12-digit UPC starting with '8'
                    if len(value_str) == 12 and value_str.isdigit() and value_str.startswith('8'):
                        print(f"Detected valid UPC '{value_str}' in {cell_address}.")

                        # Check if value is in SKUMAP
                        if value_str in SKUMAP.keys():
                            print(f"Detected UPC: {value_str}")
                            detected_sku = SKUMAP[value_str]
                            print(f"Full SKU: {detected_sku}")

                            # Write Full SKU back to the cell
                            write_to_google_sheets(detected_sku, SPREADSHEET_ID, SHEET_NAME, cell_address)

                            # Fetch lot codes for the detected SKU
                            lot_codes = fetch_lot_codes(detected_sku)
                            print(f"Lot Codes: {lot_codes}")

                            if lot_codes:
                                selected_lot_code = show_lot_code_popup(lot_codes)
                                print(f"Selected Lot Code: {selected_lot_code}")
                                if selected_lot_code:
                                    # Write the selected lot code to C{i} (aligned with the detected UPC)
                                    target_lot_cell = f"C{i}"
                                    write_to_google_sheets(selected_lot_code, SPREADSHEET_ID, SHEET_NAME, target_lot_cell)
                                    print(f"Selected Lot Code {selected_lot_code} written to {target_lot_cell}.")

                                    # Fetch and write expiration date details
                                    expiration_date = fetch_lot_details(selected_lot_code)
                                    if expiration_date is not None:
                                        if isinstance(expiration_date, pd.Timestamp):  # Format as YYYY-MM-DD
                                            expiration_date = expiration_date.strftime('%Y-%m-%d')
                                        elif isinstance(expiration_date, str) and ' ' in expiration_date:
                                            expiration_date = expiration_date.split(' ')[0]

                                        write_to_google_sheets(expiration_date, SPREADSHEET_ID, SHEET_NAME, f"E{i}")
                                        print(f"Details for Lot Code {selected_lot_code} written to E{i}.")
                                    else:
                                        write_to_google_sheets("Details Not Found", SPREADSHEET_ID, SHEET_NAME, f"E{i}")

        except Exception as e:
            print(f"Error in monitoring and updating: {e}")

        # Wait before checking again
        time.sleep(5)


if __name__ == "__main__":
    monitor_and_update()