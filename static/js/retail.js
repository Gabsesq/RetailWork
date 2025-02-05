// Load data when the page is loaded
window.onload = async () => {
    await loadLotCodes();
    renderTable();
    restoreState();
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
    updateTotals();
}

function createRow() {
    const tr = document.createElement("tr");
    
    // SKU cell
    const skuTd = document.createElement("td");
    skuTd.contentEditable = true;
    skuTd.addEventListener("input", handleSkuInput);
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
    tr.appendChild(bbTd);
    
    // U/M cell
    const umTd = document.createElement("td");
    umTd.contentEditable = true;
    tr.appendChild(umTd);
    
    // COUNT cell
    const countTd = document.createElement("td");
    countTd.contentEditable = true;
    tr.appendChild(countTd);
    
    return tr;
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
            umCell.textContent = "EA";
            
            const countCell = tr.children[4];
            if (!countCell.textContent) {
                countCell.textContent = "1";
            }
            
            const lotSelect = tr.children[1].querySelector('select');
            if (lotSelect) {
                updateLotOptions(lotSelect, SKUMAP[barcode]);
            }
            
            checkForEmptyRow();
            updateTotals();
            return;
        }
    }
    
    // Check for existing rows with same SKU
    const rows = Array.from(document.querySelectorAll('#excel-table tr')).reverse();
    let existingRow = null;
    
    // For WH cases or text input
    if (inputValue && !inputValue.startsWith("8")) {
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
            // Set up new row for WH case
            if (inputValue.toUpperCase().startsWith("WH")) {
                const lotCell = tr.children[1];
                if (lotCell.querySelector('select')) {
                    lotCell.innerHTML = '';
                    lotCell.contentEditable = true;
                }
                
                const umCell = tr.children[3];
                umCell.textContent = "CS";
                
                const countCell = tr.children[4];
                if (!countCell.textContent) {
                    countCell.textContent = "1";
                }
            }
        }
    }
    
    // For barcode inputs
    if (inputValue.length === 12 && inputValue.startsWith("8")) {
        if (SKUMAP[inputValue]) {
            const skuName = SKUMAP[inputValue];
            
            // Look for existing row with same SKU
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
                umCell.textContent = "EA";
                
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
    updateTotals();
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
        bbCell.textContent = LOT_CODES[matchingSku][selectedLot];
    } else {
        bbCell.textContent = "";
    }
}

// Add print functionality
document.getElementById('printButton').addEventListener('click', function() {
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