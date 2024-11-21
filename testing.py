from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Service account key file path
CREDENTIALS_FILE = "service_account.json"
SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID"  # Replace with your Google Sheet ID

# Authenticate and connect to Google Sheets
def connect_to_google_sheets():
    scopes = ['https://www.googleapis.com/auth/spreadsheets']
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
    return build('sheets', 'v4', credentials=creds).spreadsheets()

def test_google_sheets_access():
    print("Starting Google Sheets access test...")
    service = connect_to_google_sheets()
    try:
        sheet_metadata = service.get(spreadsheetId=SPREADSHEET_ID).execute()
        print(f"Sheet Title: {sheet_metadata['properties']['title']}")
        print(f"Sheet ID: {sheet_metadata['spreadsheetId']}")
    except Exception as e:
        print("Error accessing Google Sheets:", e)

if __name__ == "__main__":
    print("Running the script...")
    test_google_sheets_access()
    print("Script finished.")