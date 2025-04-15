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

function handleSkuInput(event) {
    try {
        const td = event.target;
        const tr = td.parentElement;
        const inputValue = td.textContent.trim();
        
        // Set U/M to CS for any input
        const umCell = tr.children[2];
        umCell.textContent = "CS";
        
        // For barcode inputs
        if (inputValue.length === 12 && inputValue.startsWith("8")) {
            if (SKUMAP[inputValue]) {
                td.textContent = SKUMAP[inputValue];
                
                // Create lot select
                const lotCell = tr.children[1];
                const lotSelect = document.createElement("select");
                lotSelect.appendChild(new Option("", ""));
                lotSelect.addEventListener("change", handleLotSelection);
                lotCell.innerHTML = '';
                lotCell.appendChild(lotSelect);
                lotCell.contentEditable = false;
                
                updateLotOptions(lotSelect, SKUMAP[inputValue]);
            }
        }
        
        // Set default count if empty
        const countCell = tr.children[3];
        if (!countCell.textContent) {
            countCell.textContent = "1";
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
            const countCell = row.children[3];
            const pallet1Cell = row.children[4];
            const pallet2Cell = row.children[5];
            
            const count = parseInt(countCell.textContent) || 0;
            total += count;
            
            if (pallet1Cell.textContent.trim()) {
                pallet1Total += count;
            }
            if (pallet2Cell.textContent.trim()) {
                pallet2Total += count;
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