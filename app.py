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
from fetchExcel import  fetch_lot_codes, fetch_lot_details, preprocess_excel_data
from PDFhelper import print_google_sheet, print_pdf

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
    sheets_service, _ = connect_to_google_services()
    range_name = f"{sheet_name}!{cell_range}"
    result = sheets_service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
    values = result.get('values', [])
    
    if values and values[0]:  # Ensure there's a value
        cell_value = str(values[0][0]).strip()  # Convert to string and strip whitespace
        return cell_value
    return None

#Batch call instead of 1 at a time
def write_to_google_sheets(batch_data, SPREADSHEET_ID):
    """
    Perform batch updates to Google Sheets.
    :param batch_data: List of dictionaries, each containing 'range' and 'values'.
    :param spreadsheet_id: The ID of the spreadsheet.
    """
    sheets_service, _ = connect_to_google_services()

    # Prepare the requests for batchUpdate
    requests = []
    for data in batch_data:
        requests.append({
            "updateCells": {
                "range": {
                    "sheetId": data["sheetId"],  # Use the appropriate sheet ID if necessary
                    "startRowIndex": data["startRowIndex"],
                    "endRowIndex": data["endRowIndex"],
                    "startColumnIndex": data["startColumnIndex"],
                    "endColumnIndex": data["endColumnIndex"]
                },
                "values": data["values"]
            }
        })

    # Send the batch update request
    body = {"requests": requests}
    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body=body
    ).execute()

def monitor_and_update():
    print("Monitoring Google Sheet for updates...")
    previous_values = {}
    sku_counts = {}
    cleared_cells = set()
    batch_updates = []  # Collect updates for batch processing

    # Preprocess Excel data upfront
    preprocessed_data = preprocess_excel_data()
    sku_data = preprocessed_data["sku_columns"]  # SKU columns are preprocessed and stored

    # Connect to Google Sheets and Drive services once
    sheets_service, drive_service = connect_to_google_services()

    while True:
        try:
            # Step 1: Check for '1' in A30 for printing
            print_trigger = read_cell(SPREADSHEET_ID, SHEET_NAME, "A30")
            if print_trigger and print_trigger.strip() == "1":
                print("Print trigger detected in A30. Starting print process...")
                
                # Call print_google_sheet with required arguments
                print_google_sheet(sheets_service, drive_service, SPREADSHEET_ID, PRINTER_NAME)
                
                # Add clearing A30 to batch_updates
                batch_updates.append({
                    "range": f"{SHEET_NAME}!A30",
                    "values": [[""]]
                })
                print("Print trigger cleared.")

            # Step 2: Read the range A4:A29 for scanning UPCs
            print("Scanning for 12-digit UPCs starting with '8' in A4:A29...")
            result = sheets_service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range="Sheet1!A4:A29"
            ).execute()
            range_values = result.get('values', [])

            # Iterate through rows in A4:A29
            for i, row in enumerate(range_values, start=4):  # Start at row 4
                cell_value = row[0] if row else None
                cell_address = f"A{i}"

                # Skip empty cells
                if not cell_value:
                    continue

                # Check if the value has changed or needs re-evaluation
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

                            # Increment the count for the existing SKU
                            if detected_sku in sku_counts:
                                sku_counts[detected_sku]["count"] += 1
                                count_cell = sku_counts[detected_sku]["count_cell"]
                                batch_updates.append({
                                    "range": f"{SHEET_NAME}!{count_cell}",
                                    "values": [[sku_counts[detected_sku]["count"]]]
                                })

                                # Add clearing the duplicate cell
                                batch_updates.append({
                                    "range": f"{SHEET_NAME}!{cell_address}",
                                    "values": [[""]]
                                })
                                cleared_cells.add(cell_address)
                                print(f"Incremented count for SKU {detected_sku}. Cleared {cell_address}.")
                            else:
                                # Add Full SKU to batch_updates
                                batch_updates.append({
                                    "range": f"{SHEET_NAME}!{cell_address}",
                                    "values": [[detected_sku]]
                                })

                                # Fetch lot codes for the detected SKU
                                lot_codes = fetch_lot_codes(detected_sku)
                                print(f"Lot Codes: {lot_codes}")

                                if lot_codes:
                                    selected_lot_code = show_lot_code_popup(lot_codes)
                                    print(f"Selected Lot Code: {selected_lot_code}")
                                    if selected_lot_code:
                                        # Add the selected lot code to batch_updates
                                        target_lot_cell = f"C{i}"
                                        batch_updates.append({
                                            "range": f"{SHEET_NAME}!{target_lot_cell}",
                                            "values": [[selected_lot_code]]
                                        })

                                        # Fetch expiration date details
                                        expiration_date = fetch_lot_details(selected_lot_code)
                                        if expiration_date is not None:
                                            batch_updates.append({
                                                "range": f"{SHEET_NAME}!E{i}",
                                                "values": [[expiration_date]]
                                            })
                                            print(f"Details for Lot Code {selected_lot_code} written to E{i}.")
                                        else:
                                            batch_updates.append({
                                                "range": f"{SHEET_NAME}!E{i}",
                                                "values": [["Details Not Found"]]
                                            })

                                        # Add the new SKU to sku_counts
                                        sku_counts[detected_sku] = {
                                            "count": 1,
                                            "count_cell": f"G{i}"
                                        }

                                        # Add the initial count to batch_updates
                                        batch_updates.append({
                                            "range": f"{SHEET_NAME}!G{i}",
                                            "values": [[1]]
                                        })
                                        print(f"Initial count '1' written to G{i} for SKU {detected_sku}.")

                                        # Add "EA" to column F if the SKU does not start with "WH-"
                                        if not detected_sku.startswith("WH-"):
                                            target_ea_cell = f"F{i}"
                                            batch_updates.append({
                                                "range": f"{SHEET_NAME}!{target_ea_cell}",
                                                "values": [["EA"]]
                                            })
                                            print(f"'EA' written to {target_ea_cell} for SKU {detected_sku}.")
        except Exception as e:
            print(f"Error in monitoring and updating: {e}")

        # Perform batch update if there are updates
        if batch_updates:
            sheets_service.spreadsheets().values().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"data": batch_updates, "valueInputOption": "RAW"}
            ).execute()
            batch_updates = []  # Clear batch_updates after processing

        time.sleep(.1)


if __name__ == "__main__":
    monitor_and_update()