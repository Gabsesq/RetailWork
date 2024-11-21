import time
import pandas as pd
import os
from SKU import SKUMAP  # Import the mapping
from ExcelSKU import EXCEL_SKU  # Import the Excel SKU mapping
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

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
    return values[0][0] if values else None

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
    try:
        return pd.read_excel(file_path)
    except PermissionError:
        print(f"Permission denied for file at {file_path}. Ensure it's not open in another program.")
        raise
    except Exception as e:
        print(f"An error occurred while reading the Excel file: {e}")
        raise

# Fetch lot numbers for a given SKU by scanning until "Total"
def get_lot_numbers_from_excel(sku):
    excel_data = read_excel_file(EXCEL_FILE_PATH)
    sku_in_excel = EXCEL_SKU.get(sku, sku)  # Handle mismatched SKUs

    # Combine all "SKU" columns into a single series for searching
    sku_columns = [col for col in excel_data.columns if "SKU" in col]
    if not sku_columns:
        print("No SKU columns found in the Excel file.")
        return ["No Lots Found"]

    # Iterate over each SKU column
    for sku_column in sku_columns:
        matching_rows = excel_data.loc[excel_data[sku_column] == sku_in_excel]
        if not matching_rows.empty:
            print(f"Found SKU in column: {sku_column}")

            # Start from the row where the SKU was found and collect lot numbers
            lot_column_index = excel_data.columns.get_loc(sku_column) + 1  # Assume "Lot #" is the next column
            lot_column_name = excel_data.columns[lot_column_index]

            # Collect lot numbers downward until encountering "Total"
            lot_numbers = []
            for index, row in matching_rows.iterrows():
                lot_row = index + 1  # Start scanning the next row
                while lot_row < len(excel_data) and str(excel_data.iloc[lot_row, lot_column_index]).strip() != "Total":
                    lot_value = excel_data.iloc[lot_row, lot_column_index]
                    if pd.notna(lot_value):
                        lot_numbers.append(str(lot_value).strip())
                    lot_row += 1

            return lot_numbers if lot_numbers else ["No Lots Found"]

    print("SKU not found in any column.")
    return ["No Lots Found"]



# Monitor A4 for a UPC and update SKU and Lot Numbers
def monitor_and_update():
    print("Waiting for UPC in cell A4...")
    previous_value = None

    while True:
        try:
            # Step 1: Check cell A4
            upc = read_cell(SPREADSHEET_ID, SHEET_NAME, "A4")
            if upc and upc != previous_value:
                print(f"Detected UPC: {upc}")
                previous_value = upc

                # Step 2: Look up Full SKU
                full_sku = SKUMAP.get(upc, "Unknown SKU")
                print(f"Full SKU: {full_sku}")

                # Stop processing if "Unknown SKU" is detected
                if full_sku == "Unknown SKU":
                    print("Stopping processing due to 'Unknown SKU'.")
                    break  # Exit the loop

                # Step 3: Write Full SKU back to A4
                write_to_google_sheets(full_sku, SPREADSHEET_ID, SHEET_NAME, "A4")

                # Step 4: Fetch lot numbers from Excel
                lot_numbers = get_lot_numbers_from_excel(full_sku)
                print(f"Lot Numbers: {lot_numbers}")

                # Write lot numbers to C4
                lot_numbers_str = ", ".join(map(str, lot_numbers))  # Ensure all elements are strings
                write_to_google_sheets(lot_numbers_str, SPREADSHEET_ID, SHEET_NAME, "C4")

                # Stop monitoring after processing
                print("Processing complete. Stopping monitoring.")
                break  # Exit the loop after processing successfully

        except Exception as e:
            print(f"Error in monitoring and updating: {e}")

        # Step 5: Wait before checking again
        time.sleep(5)  # Check every 5 seconds


if __name__ == "__main__":
    monitor_and_update()
