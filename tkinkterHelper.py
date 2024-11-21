import tkinter as tk

def show_lot_code_popup(lot_codes):
    selected_code = None

    def on_select(code):
        nonlocal selected_code
        selected_code = code
        root.destroy()  # Close the popup when a code is selected

    # Create the main Tkinter window
    root = tk.Tk()
    root.title("Select Lot Code")
    root.geometry("300x200")  # Set a reasonable size for the popup
    root.wm_attributes("-topmost", 1)  # Ensure the popup stays on top

    # Add a label at the top of the popup
    tk.Label(root, text="Select a Lot Code:", font=("Arial", 12)).pack(pady=10)

    # Add buttons for each lot code
    for code in lot_codes:
        tk.Button(root, text=code, font=("Arial", 10), command=lambda c=code: on_select(c)).pack(pady=5)

    # Start the Tkinter main loop
    root.mainloop()

    return selected_code  # Return the selected lot code
