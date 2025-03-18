import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from excel_to_json import convert_excel_to_json
import os
import git
import json
from datetime import datetime

# Update the source file path
SOURCE_FILE = r"C:\Users\Gabby\Pet Releaf\Warehouse - Documents\Current Lot Code Data 2.xlsx"

class ExcelHandler(FileSystemEventHandler):
    def __init__(self):
        self.last_json = self.read_current_json()

    def read_current_json(self):
        try:
            with open('static/js/lot_codes.json', 'r') as f:
                return json.load(f)
        except:
            return {}

    def on_modified(self, event):
        if event.src_path == SOURCE_FILE:  # Use exact path comparison
            try:
                print(f"\nChange detected in Excel file at {datetime.now()}")
                
                # Wait a moment to ensure file isn't locked
                time.sleep(2)
                
                # Store old JSON content
                old_json = self.last_json
                
                # Generate new JSON
                convert_excel_to_json()
                
                # Read new JSON
                new_json = self.read_current_json()
                
                # Compare for changes in lot codes or dates
                if self.has_relevant_changes(old_json, new_json):
                    print("Lot codes or dates changed, pushing to git...")
                    
                    # Git operations
                    repo = git.Repo(os.path.dirname(os.path.abspath(__file__)))
                    
                    # Add the file
                    repo.index.add(['static/js/lot_codes.json'])
                    
                    # Commit with timestamp
                    commit_message = f"Update lot codes - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                    repo.index.commit(commit_message)
                    
                    # Push to remote
                    origin = repo.remote('origin')
                    origin.push()
                    
                    print("Changes committed and pushed to repository")
                    self.last_json = new_json
                else:
                    print("No relevant changes detected in lot codes or dates")
                
            except Exception as e:
                print(f"Error occurred: {str(e)}")

    def has_relevant_changes(self, old_json, new_json):
        """Compare old and new JSON for lot code or date changes only"""
        for sku in set(list(old_json.keys()) + list(new_json.keys())):
            old_lots = old_json.get(sku, {})
            new_lots = new_json.get(sku, {})
            
            # Check for changes in lot numbers or dates
            if set(old_lots.keys()) != set(new_lots.keys()):
                print(f"Lot code change detected for {sku}")
                return True
            
            for lot in old_lots:
                if lot in new_lots and old_lots[lot] != new_lots[lot]:
                    print(f"Date change detected for {sku}, lot {lot}")
                    return True
        
        return False

if __name__ == "__main__":
    if not os.path.exists(SOURCE_FILE):
        print(f"Error: Could not find Excel file at {SOURCE_FILE}")
        print("Please make sure the file exists and the path is correct.")
        input("Press Enter to exit...")
        exit(1)

    print(f"Starting watcher for Excel file: {SOURCE_FILE}")
    print("Press Ctrl+C to stop")
    
    event_handler = ExcelHandler()
    observer = Observer()
    observer.schedule(event_handler, path=os.path.dirname(SOURCE_FILE), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\nWatcher stopped")
    observer.join() 