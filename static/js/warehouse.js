// At the top of warehouse.js
window.renderTable = renderTable;

// Load data when the page is loaded
window.onload = async () => {
    try {
        await loadLotCodes();
        renderTable();
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
    createSkuInput(skuTd, (scannedValue) => processSkuRow(skuTd, scannedValue), { allowNameScans: true });
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
        if (!getSkuCellText(skuCell).trim()) {
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
            if (getSkuCellText(skuCell).trim()) {
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

window.reattachSkuListeners = function() {
    document.querySelectorAll('#excel-table tr').forEach(tr => {
        const skuTd = tr.children[0];
        if (!skuTd || skuTd.dataset.scanBound === '1') return;
        createSkuInput(skuTd, (scannedValue) => processSkuRow(skuTd, scannedValue), { allowNameScans: true });
    });
};

function setupWarehouseSkuRow(tr, skuTd, skuName) {
    setSkuCellText(skuTd, skuName);

    const lotCell = tr.children[1];
    const umCell = tr.children[2];
    const countCell = tr.children[3];

    umCell.textContent = 'CS';

    const lotSelect = document.createElement('select');
    lotSelect.appendChild(new Option('', ''));
    lotSelect.addEventListener('change', handleLotSelection);
    lotCell.innerHTML = '';
    lotCell.appendChild(lotSelect);
    lotCell.contentEditable = false;
    updateLotOptions(lotSelect, skuName);

    countCell.textContent = '1';
    updateTotals();
}

function processSkuRow(skuTd, scannedValue) {
    try {
        const tr = skuTd.parentElement;
        const raw = scannedValue !== undefined ? scannedValue : getSkuCellText(skuTd);
        const inputValue = raw.trim();

        if (!inputValue) {
            Array.from(tr.children).forEach(cell => {
                if (cell === skuTd) {
                    setSkuCellText(cell, '');
                } else {
                    cell.textContent = '';
                    if (cell.querySelector('select')) {
                        cell.innerHTML = '';
                        cell.contentEditable = true;
                    }
                }
            });
            updateTotals();
            return;
        }

        const skuName = resolveSkuFromInput(inputValue);
        if (!skuName) return;

        if (isQuantityPrefixBarcode(inputValue)) {
            setupWarehouseSkuRow(tr, skuTd, skuName);
            focusNextEmptySkuCell();
            checkForEmptyRow();
            return;
        }

        const existingRow = findMergeTargetRow(tr, skuName);
        if (existingRow) {
            if (!existingRow.children[1].querySelector('select')) {
                setupWarehouseSkuRow(existingRow, existingRow.children[0], skuName);
            }

            const countCell = existingRow.children[3];
            countCell.textContent = String((parseInt(countCell.textContent, 10) || 0) + 1);

            if (existingRow !== tr) {
                setSkuCellText(skuTd, '');
                Array.from(tr.children).forEach((cell, idx) => {
                    if (idx === 0) return;
                    cell.textContent = '';
                    cell.contentEditable = true;
                });
            }

            focusNextEmptySkuCell();
            updateTotals();
            return;
        }

        setupWarehouseSkuRow(tr, skuTd, skuName);

        const allRows = Array.from(document.querySelectorAll('#excel-table tr'));
        const hasEmptyRow = allRows.some(row => !getSkuCellText(row.children[0]).trim());
        if (!hasEmptyRow) {
            document.getElementById('excel-table').appendChild(createRow());
        }

        focusNextEmptySkuCell();
        checkForEmptyRow();
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
            if (getSkuCellText(skuCell).trim()) {
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

    // Gather table data
    const rows = document.querySelectorAll('#excel-table tr');
    for (const row of rows) {
        const cells = row.children;
        const sku = cells[0]?.textContent.trim();
        const lotCode = cells[1]?.textContent.trim();
        const quantity = cells[4]?.textContent.trim() || cells[3]?.textContent.trim();
        const unit = cells[3]?.textContent.trim() || cells[2]?.textContent.trim();
        if (sku && lotCode) {
            await fetch('/api/lots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    soNumber,
                    sku,
                    lotCode,
                    quantity,
                    unit,
                    template: 'warehouse'
                })
            });
        }
    }
    window.print();
});

document.getElementById('clearButton').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all entries? This cannot be undone.')) {
        document.querySelectorAll('.order-info [contenteditable]').forEach(element => {
            element.textContent = '';
        });
        
        const tbody = document.getElementById('excel-table');
        tbody.innerHTML = '';
        localStorage.removeItem('picklistState');
        renderTable();
    }
}); 