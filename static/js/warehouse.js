// At the top of warehouse.js
window.renderTable = renderTable;

// Load data when the page is loaded
window.onload = async () => {
    try {
        await loadLotCodes();
        renderTable();
        restoreState();
        addFormattingToExistingCells();
    } catch (error) {
        console.error('Error initializing warehouse:', error);
    }
};

function renderTable() {
    try {
        const tbody = document.getElementById("excel-table");
        if (!tbody) {
            console.error('Could not find excel-table element');
            return;
        }
        
        tbody.innerHTML = "";

        // Add initial rows
        const minRows = 13;
        for (let i = 0; i < minRows; i++) {
            tbody.appendChild(createRow());
        }
        
        addCountCellListeners();
        addUmCellListeners();
        addPalletCellListeners();
        updateTotals();
    } catch (error) {
        console.error('Error rendering table:', error);
    }
}

function createRow() {
    const tr = document.createElement("tr");
    
    // SKU cell
    const skuTd = document.createElement("td");
    skuTd.contentEditable = true;
    skuTd.addEventListener("input", handleSkuInput);
    addCellFormatting(skuTd);
    tr.appendChild(skuTd);
    
    // LOT cell
    const lotTd = document.createElement("td");
    lotTd.contentEditable = true;
    addCellFormatting(lotTd);
    tr.appendChild(lotTd);
    
    // U/M cell
    const umTd = document.createElement("td");
    umTd.contentEditable = true;
    addCellFormatting(umTd);
    tr.appendChild(umTd);
    
    // CNT1 cell
    const countTd = document.createElement("td");
    countTd.contentEditable = true;
    addCellFormatting(countTd);
    tr.appendChild(countTd);
    
    // PALLET 1 cell
    const pallet1Td = document.createElement("td");
    pallet1Td.contentEditable = true;
    addCellFormatting(pallet1Td);
    tr.appendChild(pallet1Td);
    
    // PALLET 2 cell
    const pallet2Td = document.createElement("td");
    pallet2Td.contentEditable = true;
    addCellFormatting(pallet2Td);
    tr.appendChild(pallet2Td);
    
    return tr;
}

function addCellFormatting(cell) {
    try {
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
    } catch (error) {
        console.error('Error adding cell formatting:', error);
    }
}

function handleSkuInput(event) {
    try {
        const td = event.target;
        const tr = td.parentElement;
        const inputValue = td.textContent.trim();
        
        // Check for barcode with quantity prefix
        if (inputValue.length === 13 && inputValue.startsWith("1") && inputValue.substring(1).startsWith("8")) {
            const barcode = inputValue.substring(1); // Remove the "1" prefix
            if (SKUMAP[barcode]) {
                // Always create new line for prefixed barcodes
                td.textContent = SKUMAP[barcode];
                const lotCell = tr.children[1];
                const umCell = tr.children[2];
                
                // Always set to CS in warehouse template
                umCell.textContent = "CS";
                
                // Create and add select element
                const lotSelect = document.createElement("select");
                lotSelect.appendChild(new Option("", ""));
                lotSelect.addEventListener("change", handleLotSelection);
                lotCell.innerHTML = '';
                lotCell.appendChild(lotSelect);
                lotCell.contentEditable = false;
                
                updateLotOptions(lotSelect, SKUMAP[barcode]);
                
                const countCell = tr.children[3];
                if (!countCell.textContent) {
                    countCell.textContent = "1";
                }
                
                checkForEmptyRow();
                updateTotals();
                return;
            }
        }
        
        // For manual text input
        if (inputValue && !inputValue.startsWith("8")) {
            const umCell = tr.children[2];
            // Always set to CS in warehouse template
            umCell.textContent = "CS";
            
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
                const countCell = existingRow.children[3];
                const currentCount = parseInt(countCell.textContent.trim()) || 0;
                const newCount = parseInt(tr.children[3].textContent.trim()) || 1;
                countCell.textContent = currentCount + newCount;
                
                // Clear the current row
                Array.from(tr.children).forEach(cell => {
                    cell.textContent = '';
                });
                
                // Update totals after combining
                updateTotals();
            } else {
                // Set up new row
                const lotCell = tr.children[1];
                
                // Make lot cell editable
                lotCell.innerHTML = '';
                lotCell.contentEditable = true;
                
                // Set default count
                const countCell = tr.children[3];
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
                    const countCell = existingRow.children[3];
                    const currentCount = parseInt(countCell.textContent) || 0;
                    countCell.textContent = currentCount + 1;
                    
                    // Clear the current row
                    Array.from(tr.children).forEach(cell => {
                        cell.textContent = '';
                    });
                } else {
                    // Set up new row
                    td.textContent = skuName;
                    const lotCell = tr.children[1];
                    const umCell = tr.children[2];
                    
                    // Always set to CS in warehouse template
                    umCell.textContent = "CS";
                    
                    // Create and add select element
                    const lotSelect = document.createElement("select");
                    lotSelect.appendChild(new Option("", ""));
                    lotSelect.addEventListener("change", handleLotSelection);
                    lotCell.innerHTML = '';
                    lotCell.appendChild(lotSelect);
                    lotCell.contentEditable = false;
                    
                    updateLotOptions(lotSelect, skuName);
                    
                    const countCell = tr.children[3];
                    if (!countCell.textContent) {
                        countCell.textContent = "1";
                    }
                }
            }
        }
        
        checkForEmptyRow();
        updateTotals();
    } catch (error) {
        console.error('Error handling SKU input:', error);
    }
}

function updateTotals() {
    const tbody = document.getElementById("excel-table");
    const rows = tbody.getElementsByTagName("tr");
    let total = 0;
    let pallet1Total = 0;
    let pallet2Total = 0;
    
    Array.from(rows).forEach(row => {
        // Skip empty rows
        if (!row.children[0].textContent.trim()) return;

        const skuCell = row.children[0];
        const umCell = row.children[2];
        const countCell = row.children[3];
        const pallet1Cell = row.children[4];
        const pallet2Cell = row.children[5];

        // Convert count to number, default to 0 if invalid
        const count = parseInt(countCell.textContent.trim()) || 0;
        
        // Only count if it's a case (WH or CS)
        const isCase = skuCell.textContent.trim().toUpperCase().startsWith("WH") || 
                      umCell.textContent.trim().toUpperCase() === "CS";
        
        if (isCase) {
            total += count;
            
            // Track pallet totals
            if (pallet1Cell && pallet1Cell.textContent.trim()) {
                pallet1Total += count;
            }
            if (pallet2Cell && pallet2Cell.textContent.trim()) {
                pallet2Total += count;
            }
        }
    });

    // Update warehouse-specific totals
    const totalElements = {
        shipped: document.querySelector('.totals div:first-child span'),
        confirmed: document.querySelector('.totals div:last-child span'),
        pallet1: document.querySelector('.signatures div div:first-child span'),
        pallet2: document.querySelector('.signatures div div:last-child span')
    };

    if (totalElements.shipped) totalElements.shipped.textContent = total;
    if (totalElements.confirmed) totalElements.confirmed.textContent = total;
    if (totalElements.pallet1) totalElements.pallet1.textContent = pallet1Total;
    if (totalElements.pallet2) totalElements.pallet2.textContent = pallet2Total;
}

function addUmCellListeners() {
    const tbody = document.getElementById("excel-table");
    const rows = tbody.getElementsByTagName("tr");
    
    Array.from(rows).forEach(row => {
        const umCell = row.children[2];
        const skuCell = row.children[0];
        
        const observer = new MutationObserver(() => {
            if (skuCell.textContent.trim()) {
                umCell.textContent = "CS";  // Always CS in warehouse template
            }
            updateTotals();
        });
        
        observer.observe(umCell, { 
            characterData: true, 
            childList: true, 
            subtree: true 
        });
    });
}

function handleLotSelection(event) {
    const tr = event.target.closest("tr");
    const umCell = tr.children[2];
    const skuCell = tr.children[0];
    
    if (skuCell.textContent.trim()) {
        umCell.textContent = "CS";  // Always CS in warehouse template
    }
}

// Add print and clear functionality
document.addEventListener('DOMContentLoaded', function() {
    try {
        const printButton = document.getElementById('printButton');
        const clearButton = document.getElementById('clearButton');
        
        if (printButton) {
            printButton.addEventListener('click', function() {
                const soNumberBox = document.querySelector('.so-number-box');
                const soNumber = soNumberBox.textContent.trim();
                
                if (!soNumber) {
                    soNumberBox.classList.add('required');
                    alert('Please enter a PO/SO number before printing');
                    soNumberBox.focus();
                    return;
                }
                
                soNumberBox.classList.remove('required');
                window.print();
            });
        }
        
        if (clearButton) {
            clearButton.addEventListener('click', function() {
                if (confirm('Are you sure you want to clear all entries? This cannot be undone.')) {
                    document.querySelectorAll('.order-info [contenteditable]').forEach(element => {
                        element.textContent = '';
                    });
                    
                    document.querySelectorAll('.table-footer [contenteditable]').forEach(element => {
                        element.textContent = '';
                    });
                    
                    const tbody = document.getElementById('excel-table');
                    tbody.innerHTML = '';
                    renderTable();
                }
            });
        }
    } catch (error) {
        console.error('Error setting up buttons:', error);
    }
});

// Add listeners for pallet cell changes
function addPalletCellListeners() {
    const tbody = document.getElementById("excel-table");
    const rows = tbody.getElementsByTagName("tr");
    
    Array.from(rows).forEach(row => {
        const pallet1Cell = row.children[4];
        const pallet2Cell = row.children[5];
        
        if (pallet1Cell) {
            pallet1Cell.addEventListener('input', () => {
                updateTotals();
            });
        }
        if (pallet2Cell) {
            pallet2Cell.addEventListener('input', () => {
                updateTotals();
            });
        }
    });
}

// Add the rest of your event listeners and functionality here... 