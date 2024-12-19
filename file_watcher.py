import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import shutil
import os
import git
from datetime import datetime

# Configure your paths
SOURCE_FILE = "C:\\Users\\Gabby\\Pet Releaf\\Warehouse - Documents\\Current Lot Code Data 2.xlsx"
DEST_FILE = "LotCode.xlsx"
REPO_PATH = os.path.dirname(os.path.abspath(__file__))  # Current directory

class ExcelFileHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith(SOURCE_FILE):
            try:
                print(f"\nChange detected in {SOURCE_FILE} at {datetime.now()}")
                
                # Wait a brief moment to ensure file is not locked
                time.sleep(2)
                
                # Copy and rename the file
                shutil.copy2(SOURCE_FILE, DEST_FILE)
                print(f"File copied and renamed to {DEST_FILE}")
                
                # Git operations
                repo = git.Repo(REPO_PATH)
                
                # Add the file
                repo.index.add([DEST_FILE])
                
                # Commit with timestamp
                commit_message = f"Update lot codes - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                repo.index.commit(commit_message)
                
                # Push to remote
                origin = repo.remote('origin')
                origin.push()
                
                print("Changes committed and pushed to repository")
                print("Waiting for next change...")
                
            except Exception as e:
                print(f"Error occurred: {str(e)}")

def start_watching():
    # Create an observer and handler
    event_handler = ExcelFileHandler()
    observer = Observer()
    
    # Start watching the directory containing the source file
    watch_path = os.path.dirname(os.path.abspath(SOURCE_FILE))
    observer.schedule(event_handler, watch_path, recursive=False)
    observer.start()
    
    print(f"Watching for changes in {SOURCE_FILE}...")
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\nFile watching stopped")
    
    observer.join()

if __name__ == "__main__":
    # Install required packages
    try:
        import watchdog
        import git
    except ImportError:
        print("Installing required packages...")
        os.system('pip install watchdog gitpython')
        
    start_watching() 