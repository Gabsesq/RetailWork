// Load data when the page is loaded
window.onload = async () => {
    await loadLotCodes();
    renderTable();
    restoreState();
    addFormattingToExistingCells();
};

window.renderTable = renderTable;

function renderTable() {
    const tbody = document.getElementById("excel-table");
    tbody.innerHTML = "";

    // Add initial rows
    const minRows = 13;
    for (let i = 0; i < minRows; i++) {
        tbody.appendChild(createRow());
    }
    
    addCountCellListeners();
}

function createRow() {
    const tr = document.createElement("tr");
    
    // SKU cell
    const skuTd = document.createElement("td");
    skuTd.contentEditable = true;
    skuTd.addEventListener("input", handleSkuInput);
    skuTd.addEventListener("focus", () => {
        // Ensure the cell is ready for scanner input
        skuTd.focus();
        // Select all text if any exists
        if (skuTd.textContent) {
            const range = document.createRange();
            range.selectNodeContents(skuTd);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    });
    addCellFormatting(skuTd);
    tr.appendChild(skuTd);
    
    // LOT cell
    const lotTd = document.createElement("td");
    const lotSelect = document.createElement("select");
    lotSelect.appendChild(new Option("", ""));
    lotSelect.addEventListener("change", handleLotSelection);
    lotTd.appendChild(lotSelect);
    tr.appendChild(lotTd);
    
    // B/B cell
    const bbTd = document.createElement("td");
    bbTd.contentEditable = true;
    addCellFormatting(bbTd);
    tr.appendChild(bbTd);
    
    // U/M cell
    const umTd = document.createElement("td");
    umTd.contentEditable = true;
    addCellFormatting(umTd);
    tr.appendChild(umTd);
    
    // COUNT cell
    const countTd = document.createElement("td");
    countTd.contentEditable = true;
    addCellFormatting(countTd);
    tr.appendChild(countTd);
    
    return tr;
}

// Add function to prevent line breaks and normalize spaces
function addCellFormatting(cell) {
    // Prevent line breaks
    cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });

    // Normalize spaces on paste
    cell.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const normalizedText = text.replace(/\s+/g, ' ').trim();
        document.execCommand('insertText', false, normalizedText);
    });

    // Normalize spaces on blur
    cell.addEventListener('blur', () => {
        const normalizedText = cell.textContent.replace(/\s+/g, ' ').trim();
        cell.textContent = normalizedText;
    });
}

// Add formatting to existing editable cells
function addFormattingToExistingCells() {
    document.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        addCellFormatting(cell);
    });
}

// Add a helper function to check if SKU should use "Set"
function shouldUseSet(sku) {
    const upperSku = sku.toUpperCase();
    return upperSku.startsWith("DB") || upperSku.startsWith("PR-INT-CS");
}

function handleSkuInput(event) {
    const td = event.target;
    const tr = td.parentElement;
    const inputValue = td.textContent.trim();
    
    // Check for barcode with quantity prefix
    if (inputValue.length === 13 && inputValue.startsWith("1") && inputValue.substring(1).startsWith("8")) {
        const barcode = inputValue.substring(1); // Remove the "1" prefix
        if (SKUMAP[barcode]) {
            // Always create new line for prefixed barcodes
            td.textContent = SKUMAP[barcode];
            
            const umCell = tr.children[3];
            // Set U/M to "Set" if SKU starts with "DB" or "PR-INT-CS", otherwise "EA"
            umCell.textContent = shouldUseSet(SKUMAP[barcode]) ? "Set" : "EA";
            
            const countCell = tr.children[4];
            if (!countCell.textContent) {
                countCell.textContent = "1";
            }
            
            const lotSelect = tr.children[1].querySelector('select');
            if (lotSelect) {
                updateLotOptions(lotSelect, SKUMAP[barcode]);
            }
            
            checkForEmptyRow();
            return;
        }
    }
    
    // For manual text input
    if (inputValue && !inputValue.startsWith("8")) {
        const umCell = tr.children[3];
        if (inputValue.toUpperCase().startsWith("WH")) {
            umCell.textContent = "CS";
        } else if (shouldUseSet(inputValue)) {
            umCell.textContent = "Set";
        } else {
            umCell.textContent = "EA";
        }
        
        // Rest of the existing row handling...
        const rows = Array.from(document.querySelectorAll('#excel-table tr')).reverse();
        let existingRow = null;
        
        // Look for existing row with same SKU text
        for (let row of rows) {
            if (row !== tr && 
                row.children[0].textContent.trim().toLowerCase() === inputValue.toLowerCase()) {
                existingRow = row;
                break;
            }
        }
        
        if (existingRow) {
            // Add to existing row's count
            const countCell = existingRow.children[4];
            const currentCount = parseInt(countCell.textContent) || 0;
            countCell.textContent = currentCount + 1;
            
            // Clear the current row
            Array.from(tr.children).forEach(cell => {
                if (cell.querySelector('select')) {
                    cell.querySelector('select').value = '';
                } else {
                    cell.textContent = '';
                }
            });
        } else {
            // Set up new row
            const lotCell = tr.children[1];
            if (inputValue.toUpperCase().startsWith("WH")) {
                if (lotCell.querySelector('select')) {
                    lotCell.innerHTML = '';
                    lotCell.contentEditable = true;
                }
            }
            
            const countCell = tr.children[4];
            if (!countCell.textContent) {
                countCell.textContent = "1";
            }
        }
    }
    
    // For barcode inputs
    if (inputValue.length === 12 && inputValue.startsWith("8")) {
        if (SKUMAP[inputValue]) {
            const skuName = SKUMAP[inputValue];
            
            // Look for existing row with same SKU
            const rows = Array.from(document.querySelectorAll('#excel-table tr')).reverse();
            let existingRow = null;
            
            for (let row of rows) {
                if (row !== tr && row.children[0].textContent.trim() === skuName) {
                    existingRow = row;
                    break;
                }
            }
            
            if (existingRow) {
                // Add to existing row's count
                const countCell = existingRow.children[4];
                const currentCount = parseInt(countCell.textContent) || 0;
                countCell.textContent = currentCount + 1;
                
                // Clear the current row
                Array.from(tr.children).forEach(cell => {
                    if (cell.querySelector('select')) {
                        cell.querySelector('select').value = '';
                    } else {
                        cell.textContent = '';
                    }
                });
            } else {
                // Set up new row
                td.textContent = skuName;
                const umCell = tr.children[3];
                // Set U/M to "Set" if SKU starts with "DB" or "PR-INT-CS", otherwise "EA"
                umCell.textContent = shouldUseSet(skuName) ? "Set" : "EA";
                
                const countCell = tr.children[4];
                if (!countCell.textContent) {
                    countCell.textContent = "1";
                }
                
                const lotSelect = tr.children[1].querySelector('select');
                if (lotSelect) {
                    updateLotOptions(lotSelect, skuName);
                }
            }
        }
    }
    
    checkForEmptyRow();
}

function handleLotSelection(event) {
    const select = event.target;
    const tr = select.closest("tr");
    const selectedLot = select.value;
    const skuName = tr.children[0].textContent.trim();
    const bbCell = tr.children[2];  // B/B cell
    
    const normalizedInputSku = normalizeSkuName(skuName);
    const matchingSku = Object.keys(LOT_CODES).find(key => 
        normalizeSkuName(key) === normalizedInputSku
    );
    
    if (selectedLot && matchingSku && LOT_CODES[matchingSku] && LOT_CODES[matchingSku][selectedLot]) {
        bbCell.textContent = LOT_CODES[matchingSku][selectedLot].bb_date;
    } else {
        bbCell.textContent = "";
    }
}

// Add print functionality
document.getElementById('printButton').addEventListener('click', async function() {
    const soNumberBox = document.querySelector('.so-number-box');
    const soNumber = soNumberBox.textContent.trim();
    
    if (!soNumber) {
        soNumberBox.classList.add('required');
        alert('Please enter a PO/SO number before printing');
        soNumberBox.focus();
        return;
    }
    
    soNumberBox.classList.remove('required');
    
    // Capture and store data before printing
    try {
        await captureAndStoreLotsData(soNumber, 'retail');
        window.print();
    } catch (error) {
        console.error('Error storing lots data:', error);
        // Still print even if storage fails
        window.print();
    }
});

// Add clear functionality
document.getElementById('clearButton').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all entries? This cannot be undone.')) {
        document.querySelectorAll('.order-info [contenteditable]').forEach(element => {
            element.textContent = '';
        });
        
        const tbody = document.getElementById('excel-table');
        tbody.innerHTML = '';
        renderTable();
    }
});

// Function to capture and store lots data
async function captureAndStoreLotsData(soNumber, template) {
    const tbody = document.getElementById('excel-table');
    const rows = tbody.getElementsByTagName('tr');
    const entries = [];
    
    // Collect data from all rows with SKU data
    Array.from(rows).forEach(row => {
        const skuCell = row.children[0];
        const lotCell = row.children[1];
        const bbCell = row.children[2];
        const umCell = row.children[3];
        const countCell = row.children[4];
        
        const sku = skuCell.textContent.trim();
        if (sku) {
            let lotCode = '';
            if (lotCell.querySelector('select')) {
                lotCode = lotCell.querySelector('select').value;
            } else {
                lotCode = lotCell.textContent.trim();
            }
            
            const unit = umCell.textContent.trim();
            const quantity = countCell.textContent.trim();
            
            entries.push({
                soNumber,
                sku,
                lotCode,
                quantity,
                unit,
                template
            });
        }
    });
    
    // Store each entry in the database
    for (const entry of entries) {
        try {
            const response = await fetch('/api/lots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entry)
            });
            
            if (!response.ok) {
                console.error('Failed to store entry:', entry);
            }
        } catch (error) {
            console.error('Error storing entry:', error);
        }
    }
    
    console.log(`Stored ${entries.length} entries for SO/PO: ${soNumber}`);
}

// Initialize scanner focus management - TARGETED APPROACH
document.addEventListener('DOMContentLoaded', function() {
    // Only target our specific table cells, not global document
    const table = document.getElementById('excel-table');
    if (table) {
        // Add click handlers only to table cells
        table.addEventListener('click', function(e) {
            if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
                // Focus the clicked cell
                e.target.focus();
                
                // Clear any existing text for scanner input
                if (e.target === e.target.parentElement.children[0]) { // SKU column
                    e.target.textContent = '';
                }
            }
        });
        
        // Add keyboard event listener only to table cells
        table.addEventListener('keydown', function(e) {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.contentEditable === 'true' && activeElement.tagName === 'TD') {
                // If Enter is pressed, move to next cell (common scanner behavior)
                if (e.key === 'Enter') {
                    // Don't prevent default for scanner input - let it complete first
                    // Use a small delay to allow scanner to finish
                    setTimeout(() => {
                        const tr = activeElement.parentElement;
                        const currentIndex = Array.from(tr.children).indexOf(activeElement);
                        const nextCell = tr.children[currentIndex + 1];
                        if (nextCell && nextCell.contentEditable === 'true') {
                            nextCell.focus();
                        }
                    }, 50); // Small delay to let scanner complete
                }
            }
        });
        
        // Auto-focus first SKU cell for immediate scanning (only if table exists)
        setTimeout(() => {
            const firstSkuCell = table.querySelector('tr:first-child td:first-child');
            if (firstSkuCell) {
                firstSkuCell.focus();
            }
        }, 100);
    }
    
    // Add cleanup when leaving the page
    window.addEventListener('beforeunload', function() {
        // Clear any focus to prevent interference
        if (document.activeElement) {
            document.activeElement.blur();
        }
    });
}); 