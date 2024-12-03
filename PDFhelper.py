import os
import traceback
import win32print
import win32api
from io import BytesIO
from googleapiclient.http import MediaIoBaseDownload


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
        traceback.print_exc()
        print(f"Error in printing PDF using win32print: {e}")


def print_google_sheet(sheets_service, drive_service, spreadsheet_id, printer_name):
    """
    Export Google Sheet to PDF and print using the specified printer.
    """
    try:
        file_id = spreadsheet_id  # Google Sheet's ID
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
        print_pdf(pdf_path, printer_name)

    except Exception as e:
        traceback.print_exc()
        print(f"Error in printing Google Sheet: {e}")
