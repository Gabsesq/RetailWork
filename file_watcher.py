import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from excel_to_json import convert_excel_to_json

class ExcelHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith('LotCode.xlsx'):
            print("Excel file changed, updating JSON...")
            convert_excel_to_json()

if __name__ == "__main__":
    event_handler = ExcelHandler()
    observer = Observer()
    observer.schedule(event_handler, path='.', recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join() 