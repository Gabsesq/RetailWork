// At the top of warehouse.js
window.renderTable = renderTable;

// Load data when the page is loaded
window.onload = async () => {
    try {
        await loadLotCodes();
        renderTable();
        restoreState();
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
    tr.appendChild(skuTd);
    
    // LOT cell
    const lotTd = document.createElement("td");
    lotTd.contentEditable = true;
    tr.appendChild(lotTd);
    
    // U/M cell
    const umTd = document.createElement("td");
    umTd.contentEditable = true;
    tr.appendChild(umTd);
    
    // CNT1 cell
    const countTd = document.createElement("td");
    countTd.contentEditable = true;
    countTd.addEventListener("input", handleCountInput);
    countTd.addEventListener("keydown", handleCountKeydown);
    tr.appendChild(countTd);
    
    // PALLET 1 cell
    const pallet1Td = document.createElement("td");
    pallet1Td.contentEditable = true;
    tr.appendChild(pallet1Td);
    
    // PALLET 2 cell
    const pallet2Td = document.createElement("td");
    pallet2Td.contentEditable = true;
    tr.appendChild(pallet2Td);
    
    return tr;
}

function handleCountKeydown(event) {
    try {
        // Allow: backspace, delete, tab, escape, enter, numbers
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight'];
        const isNumber = /[0-9]/.test(event.key);
        
        if (!allowedKeys.includes(event.key) && !isNumber) {
            event.preventDefault();
            return false;
        }

        // If it's backspace or delete, schedule an update
        if (event.key === 'Backspace' || event.key === 'Delete') {
            setTimeout(() => {
                validateAndUpdateCount(event.target);
            }, 0);
        }
    } catch (error) {
        console.error('Error handling count keydown:', error);
    }
}

function handleCountInput(event) {
    try {
        validateAndUpdateCount(event.target);
    } catch (error) {
        console.error('Error handling count input:', error);
    }
}

function validateAndUpdateCount(countCell) {
    try {
        const tr = countCell.parentElement;
        const skuCell = tr.children[0];
        
        // If there's no SKU, don't allow count
        if (!skuCell.textContent.trim()) {
            countCell.textContent = '';
            updateTotals();
            return;
        }

        let count = countCell.textContent.trim();
        
        // Remove any non-numeric characters
        count = count.replace(/[^0-9]/g, '');
        
        // Convert to number and validate
        let numCount = parseInt(count);
        
        // If count is not a valid number or is 0, reset to 1 or empty
        if (isNaN(numCount) || numCount === 0) {
            if (skuCell.textContent.trim()) {
                numCount = 1;
            } else {
                numCount = '';
            }
        }
        
        // Update the cell with the validated count
        countCell.textContent = numCount;
        
        // Update totals
        updateTotals();
    } catch (error) {
        console.error('Error validating count:', error);
    }
}

function handleSkuInput(event) {
    try {
        const td = event.target;
        const tr = td.parentElement;
        const inputValue = td.textContent.trim();
        
        if (!inputValue) {
            // Clear the entire row if SKU is deleted
            Array.from(tr.children).forEach(cell => {
                cell.textContent = '';
                if (cell.firstChild && cell.firstChild.tagName === 'SELECT') {
                    cell.innerHTML = '';
                    cell.contentEditable = true;
                }
            });
            updateTotals();
            return;
        }

        // Look for existing row with same SKU
        const rows = Array.from(document.querySelectorAll('#excel-table tr')).reverse();
        let existingRow = null;
        
        // For barcode inputs
        if (inputValue.length === 12 && inputValue.startsWith("8")) {
            if (SKUMAP[inputValue]) {
                const skuName = SKUMAP[inputValue];
                
                // Find existing row with same SKU
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
                    
                    umCell.textContent = "CS";
                    
                    // Create lot select
                    const lotSelect = document.createElement("select");
                    lotSelect.appendChild(new Option("", ""));
                    lotSelect.addEventListener("change", handleLotSelection);
                    lotCell.innerHTML = '';
                    lotCell.appendChild(lotSelect);
                    lotCell.contentEditable = false;
                    
                    updateLotOptions(lotSelect, skuName);
                    
                    // Set default count
                    const countCell = tr.children[3];
                    if (!countCell.textContent) {
                        countCell.textContent = "1";
                    }
                }
            }
        } else {
            // For manual text input
            // Find existing row with same SKU text
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
                const currentCount = parseInt(countCell.textContent) || 0;
                const newCount = parseInt(tr.children[3].textContent) || 1;
                countCell.textContent = currentCount + newCount;
                
                // Clear the current row
                Array.from(tr.children).forEach(cell => {
                    cell.textContent = '';
                });
            } else {
                // Set up new row
                const umCell = tr.children[2];
                umCell.textContent = "CS";
                
                // Set default count
                const countCell = tr.children[3];
                if (!countCell.textContent) {
                    countCell.textContent = "1";
                }
            }
        }
        
        // After setting up a new row or combining rows, validate the count
        const countCell = tr.children[3];
        validateAndUpdateCount(countCell);
        
        // Check if we need to add a new empty row
        const allRows = Array.from(document.querySelectorAll('#excel-table tr'));
        const hasEmptyRow = allRows.some(row => !row.children[0].textContent.trim());
        if (!hasEmptyRow) {
            document.getElementById('excel-table').appendChild(createRow());
        }
        
        updateTotals();
    } catch (error) {
        console.error('Error handling SKU input:', error);
    }
}

function handleLotSelection(event) {
    try {
        const select = event.target;
        const tr = select.closest("tr");
        const umCell = tr.children[2];
        umCell.textContent = "CS";
    } catch (error) {
        console.error('Error handling lot selection:', error);
    }
}

function updateTotals() {
    try {
        const tbody = document.getElementById("excel-table");
        const rows = tbody.getElementsByTagName("tr");
        let total = 0;
        let pallet1Total = 0;
        let pallet2Total = 0;
        
        Array.from(rows).forEach(row => {
            const skuCell = row.children[0];
            const countCell = row.children[3];
            const pallet1Cell = row.children[4];
            const pallet2Cell = row.children[5];
            
            // Only count if there's a valid SKU
            if (skuCell.textContent.trim()) {
                const count = parseInt(countCell.textContent) || 0;
                total += count;
                
                if (pallet1Cell.textContent.trim()) {
                    pallet1Total += count;
                }
                if (pallet2Cell.textContent.trim()) {
                    pallet2Total += count;
                }
            }
        });
        
        // Update totals
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
    } catch (error) {
        console.error('Error updating totals:', error);
    }
}

// Replace the initializeButtons function with direct event listeners
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
        await captureAndStoreLotsData(soNumber, 'warehouse');
        window.print();
    } catch (error) {
        console.error('Error storing lots data:', error);
        // Still print even if storage fails
        window.print();
    }
});

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
        const umCell = row.children[2];
        const countCell = row.children[3];
        
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

// Initialize scanner focus management
document.addEventListener('DOMContentLoaded', function() {
    // Add global focus management for scanner
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
            // Focus the clicked cell
            e.target.focus();
            
            // Clear any existing text for scanner input
            if (e.target === e.target.parentElement.children[0]) { // SKU column
                e.target.textContent = '';
            }
        }
    });
    
    // Add keyboard event listener for scanner input
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.contentEditable === 'true' && activeElement.tagName === 'TD') {
            // If Enter is pressed, move to next cell (common scanner behavior)
            if (e.key === 'Enter') {
                e.preventDefault();
                const tr = activeElement.parentElement;
                const currentIndex = Array.from(tr.children).indexOf(activeElement);
                const nextCell = tr.children[currentIndex + 1];
                if (nextCell && nextCell.contentEditable === 'true') {
                    nextCell.focus();
                }
            }
        }
    });
    
    // Auto-focus first SKU cell for immediate scanning
    setTimeout(() => {
        const firstSkuCell = document.querySelector('#excel-table tr:first-child td:first-child');
        if (firstSkuCell) {
            firstSkuCell.focus();
        }
    }, 100);
}); 