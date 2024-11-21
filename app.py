import time
import pandas as pd
import os
from SKU import SKUMAP  # Import the mapping
from ExcelSKU import EXCEL_SKU  # Import the Excel SKU mapping
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from tkinkterHelper import show_lot_code_popup

# File path to the local Excel file
EXCEL_FILE_PATH = r"C:/Users/Gabby/Pet Releaf/Warehouse - Documents/Current Lot Code Data 2.xlsx"

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
    print("Waiting for UPC in cell A4...")
    previous_value = None

    while True:
        try:
            # Step 1: Read cell A4
            value = read_cell(SPREADSHEET_ID, SHEET_NAME, "A4")
            print(f"Detected Value in A4: {value}")

            # Step 2: Process if value has changed
            if value and value != previous_value:
                previous_value = value
                value_str = str(value).strip()

                # Check if value is in SKUMAP
                if value_str in SKUMAP.keys():
                    print(f"Detected UPC: {value_str}")
                    detected_sku = SKUMAP[value_str]
                    print(f"Full SKU: {detected_sku}")

                    # Write Full SKU back to A4
                    write_to_google_sheets(detected_sku, SPREADSHEET_ID, SHEET_NAME, "A4")

                    # Fetch lot codes for the detected SKU
                    lot_codes = fetch_lot_codes(detected_sku)
                    print(f"Lot Codes: {lot_codes}")

                    # Write lot codes to C4
                    # Instead of writing a single string, write the list as rows
                    # Call the Tkinter popup to let the user select a lot code
                    if lot_codes:
                        selected_lot_code = show_lot_code_popup(lot_codes)
                        print(f"Selected Lot Code: {selected_lot_code}")
                        if selected_lot_code:
                            expiration_date = fetch_lot_details(selected_lot_code)
                            if expiration_date is not None:
                                expiration_date = str(expiration_date)  # Convert Timestamp to string
                                write_to_google_sheets(expiration_date, SPREADSHEET_ID, SHEET_NAME, "E4")
                                print(f"Details for Lot Code {selected_lot_code} written to E4 and F4.")
                            else:
                                write_to_google_sheets("Details Not Found", SPREADSHEET_ID, SHEET_NAME, "E4")
                                write_to_google_sheets("Details Not Found", SPREADSHEET_ID, SHEET_NAME, "F4")
                        else:
                            print("No lot code selected.")

            # Step 3: Monitor D4 for lot code selection
            selected_lot_code = read_cell(SPREADSHEET_ID, SHEET_NAME, "C4")
            print(f"Detected Lot Code in C4: {selected_lot_code}")

            if selected_lot_code:
                expiration_date = fetch_lot_details(selected_lot_code)
                if expiration_date is not None:
                    expiration_date = str(expiration_date)  # Convert Timestamp to string
                    write_to_google_sheets(expiration_date, SPREADSHEET_ID, SHEET_NAME, "E4")
                    print(f"Details for Lot Code {selected_lot_code} written to E4 and F4.")
                else:
                    write_to_google_sheets("Details Not Found", SPREADSHEET_ID, SHEET_NAME, "E4")
                    write_to_google_sheets("Details Not Found", SPREADSHEET_ID, SHEET_NAME, "F4")

        except Exception as e:
            print(f"Error in monitoring and updating: {e}")

        # Wait before checking again
        time.sleep(5)

if __name__ == "__main__":
    monitor_and_update()