import time
import pandas as pd
import os
from SKU import SKUMAP  # Import the mapping
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from tkinkterHelper import show_lot_code_popup
import win32print
import win32api
from io import BytesIO
from googleapiclient.http import MediaIoBaseDownload

# File path to the local Excel file
EXCEL_FILE_PATH = r"Current Lot Code Data 2.xlsx"
PRINTER_NAME = "Brother MFC-L8900CDW series"
excel_data = pd.read_excel(EXCEL_FILE_PATH)
# Google Sheets setup
SPREADSHEET_ID = "1MYUwuPTPNY7P_e1sBvzV1m-VDDlJq6mnrLy3tGM1Duw"
SHEET_NAME = "Sheet1"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
CREDENTIALS_FILE = "service_account.json"

def connect_to_google_services():
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    sheets_service = build('sheets', 'v4', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    return sheets_service, drive_service


def read_cell(spreadsheet_id, sheet_name, cell_range):
    sheets_service, _ = connect_to_google_services()  # Extract only sheets_service
    range_name = f"{sheet_name}!{cell_range}"
    result = sheets_service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
    values = result.get('values', [])
    return str(values[0][0]).strip() if values else None


def write_to_google_sheets(data, spreadsheet_id, sheet_name, start_cell):
    sheets_service, _ = connect_to_google_services()  # Extract only sheets_service
    # Ensure data is always a 2D list
    if isinstance(data, str) or isinstance(data, int):  # Single value
        body = {"values": [[data]]}
    elif isinstance(data, list):  # Already a list
        body = {"values": [data] if isinstance(data[0], list) else [[val] for val in data]}
    else:
        raise ValueError("Data format is invalid. Must be a string, integer, or list.")

    sheets_service.spreadsheets().values().update(
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
    
    # Normalize the input SKU to lowercase for comparison
    sku_lower = sku.lower()
    
    # List of column indices to search for SKUs
    sku_columns = [0, 7, 14, 21]  # A, H, O, V
    
    # Initialize an empty list for lot codes
    lot_codes = []
    
    # Iterate over each specified column
    for column_index in sku_columns:
        if column_index >= len(excel_data.columns):
            print(f"Column index {column_index} is out of range.")
            continue

        # Normalize the SKU column for comparison
        excel_data.iloc[:, column_index] = excel_data.iloc[:, column_index].astype(str).str.strip().str.lower()

        # Find the row with the matching SKU
        matching_row = excel_data.loc[excel_data.iloc[:, column_index] == sku_lower]
        if matching_row.empty:
            print(f"SKU '{sku}' not found in column index {column_index}.")
            continue

        # Debug: Print the matching row
        print(f"Matching row for '{sku}' in column index {column_index}:\n{matching_row}")

        # Get the row index for the matching SKU
        row_index = matching_row.index[0]
        lot_column_index = column_index + 1

        # Traverse downward until encountering "Total"
        while row_index < len(excel_data):
            lot_value = excel_data.iloc[row_index, lot_column_index]

            # Debug: Print the lot value being checked
            print(f"Row: {row_index}, Lot Value: {lot_value} (Type: {type(lot_value)})")

            if isinstance(lot_value, str) and lot_value.strip().lower() == "total":
                print("Reached 'Total'. Stopping the scan.")
                break
            if pd.notna(lot_value):
                lot_codes.append(str(lot_value).strip())
            row_index += 1

    print(f"Lot codes for SKU '{sku}': {lot_codes}")
    return lot_codes

def fetch_lot_details(lot_code):
    # Read the Excel file
    excel_data = pd.read_excel(EXCEL_FILE_PATH)

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



def print_pdf(file_path, printer_name):
    """
    Print a PDF file using the specified printer.
    """
    try:
        with open(file_path, "rb") as pdf_file:
            raw_data = pdf_file.read()

        # Get the printer handle
        printer_handle = win32print.OpenPrinter(printer_name)
        printer_info = win32print.GetPrinter(printer_handle, 2)

        # Start a print job
        job_name = os.path.basename(file_path)
        job_id = win32print.StartDocPrinter(printer_handle, 1, (job_name, None, "RAW"))
        win32print.StartPagePrinter(printer_handle)

        # Write data to the printer
        win32print.WritePrinter(printer_handle, raw_data)

        # End the print job
        win32print.EndPagePrinter(printer_handle)
        win32print.EndDocPrinter(printer_handle)
        win32print.ClosePrinter(printer_handle)

        print(f"Printing {file_path} to {printer_name} completed.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in printing PDF using win32print: {e}")

def print_google_sheet():
    """
    Export Google Sheet to PDF and print using the specified printer.
    """
    try:
        sheets_service, drive_service = connect_to_google_services()
        file_id = SPREADSHEET_ID  # Google Sheet's ID
        mime_type = "application/pdf"

        # Export the Google Sheet as a PDF using the Drive API
        request = drive_service.files().export(fileId=file_id, mimeType=mime_type)
        file_stream = BytesIO()
        downloader = MediaIoBaseDownload(file_stream, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()
            print(f"Download Progress: {int(status.progress() * 100)}%")

        # Save the PDF locally
        pdf_path = os.path.abspath("sheet_to_print.pdf")
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(file_stream.getvalue())
        print(f"PDF saved at {pdf_path}")

        # Call the helper function to print the PDF
        print_pdf(pdf_path, PRINTER_NAME)

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in printing Google Sheet: {e}")




def monitor_and_update():
    print("Monitoring Google Sheet for updates...")
    previous_values = {}
    sku_counts = {}  # Dictionary to track SKUs and their counts
    cleared_cells = set()  # Track cleared cells for re-evaluation

    while True:
        try:
            # Connect to Google Sheets
            sheets_service, _ = connect_to_google_services()  # Extract sheets_service
            
            # Step 2: Check for 'P' in A30 for printing
            print_trigger = read_cell(SPREADSHEET_ID, SHEET_NAME, "A30")
            if print_trigger and print_trigger.upper() == "1":
                print("Print trigger detected in A30. Starting print process...")
                print_google_sheet()
                
                # Clear the 'P' after printing to prevent repeated triggers
                write_to_google_sheets("", SPREADSHEET_ID, SHEET_NAME, "A30")
                print("Print trigger cleared.")
            
            # Step 3: Read the range A4:A29
            print("Scanning for 12-digit UPCs starting with '8' in A4:A29...")
            result = sheets_service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range="Sheet1!A4:A29"
            ).execute()
            range_values = result.get('values', [])

            # Ensure the list is the correct length
            while len(range_values) < 26:  # 26 rows from A4 to A29
                range_values.append([None])

            # Step 4: Flatten the range_values (2D array) into a list and enumerate rows
            for i, row in enumerate(range_values, start=4):  # Start at A4
                cell_value = row[0] if row else None
                cell_address = f"A{i}"

                # Check if the value has changed or if it is in the cleared_cells set
                if cell_value and (cell_address not in previous_values or previous_values[cell_address] != cell_value or cell_address in cleared_cells):
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

                            if detected_sku in sku_counts:
                                # Increment the count for the existing SKU
                                sku_counts[detected_sku]["count"] += 1
                                count_cell = sku_counts[detected_sku]["count_cell"]
                                write_to_google_sheets(sku_counts[detected_sku]["count"], SPREADSHEET_ID, SHEET_NAME, count_cell)

                                # Clear the duplicate cell and add it to cleared_cells
                                write_to_google_sheets("", SPREADSHEET_ID, SHEET_NAME, cell_address)
                                cleared_cells.add(cell_address)  # Add to cleared cells set
                                print(f"Incremented count for SKU {detected_sku}. Cleared {cell_address}.")

                            else:
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
                                            write_to_google_sheets(expiration_date, SPREADSHEET_ID, SHEET_NAME, f"E{i}")
                                            print(f"Details for Lot Code {selected_lot_code} written to E{i}.")
                                        else:
                                            write_to_google_sheets("Details Not Found", SPREADSHEET_ID, SHEET_NAME, f"E{i}")

                                        # Add the new SKU to sku_counts
                                        sku_counts[detected_sku] = {
                                            "count": 1,
                                            "count_cell": f"G{i}"
                                        }

                                        # Write the initial count to the Google Sheet
                                        write_to_google_sheets(1, SPREADSHEET_ID, SHEET_NAME, f"G{i}")
                                        print(f"Initial count '1' written to G{i} for SKU {detected_sku}.")
                                        # Write "EA" to column F if the SKU does not start with "WH-"
                                        if not detected_sku.startswith("WH-"):
                                            target_ea_cell = f"F{i}"  # Corresponds to the F column of the current row
                                            write_to_google_sheets("EA", SPREADSHEET_ID, SHEET_NAME, target_ea_cell)
                                            print(f"'EA' written to {target_ea_cell} for SKU {detected_sku}.")
        except Exception as e:
            print(f"Error in monitoring and updating: {e}")

        # Wait before checking again
        time.sleep(1)




if __name__ == "__main__":
    monitor_and_update()