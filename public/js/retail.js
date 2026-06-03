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
    attachSkuScanHandlers(skuTd, () => processSkuRow(skuTd));
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

window.addFormattingToExistingCells = addFormattingToExistingCells;

window.reattachSkuListeners = function() {
    document.querySelectorAll('#excel-table tr').forEach(tr => {
        const skuTd = tr.children[0];
        if (!skuTd || skuTd.dataset.scanBound === '1') return;
        attachSkuScanHandlers(skuTd, () => processSkuRow(skuTd));
        addCellFormatting(skuTd);
    });
};

// Add a helper function to check if SKU should use "Set"
function shouldUseSet(sku) {
    const upperSku = sku.toUpperCase();
    return upperSku.startsWith("DB") || upperSku.startsWith("PR-INT-CS");
}

function clearRetailScanRow(tr) {
    Array.from(tr.children).forEach((cell, idx) => {
        if (idx === 1) {
            const lotSelect = document.createElement('select');
            lotSelect.appendChild(new Option('', ''));
            lotSelect.addEventListener('change', handleLotSelection);
            cell.innerHTML = '';
            cell.appendChild(lotSelect);
            cell.contentEditable = false;
        } else {
            cell.textContent = '';
        }
    });
}

function setupNewRetailRow(tr, td, skuName) {
    td.textContent = skuName;

    const umCell = tr.children[3];
    if (skuName.toUpperCase().startsWith("WH")) {
        umCell.textContent = "CS";
    } else {
        umCell.textContent = shouldUseSet(skuName) ? "Set" : "EA";
    }

    const lotCell = tr.children[1];
    if (skuName.toUpperCase().startsWith("WH")) {
        if (lotCell.querySelector('select')) {
            lotCell.innerHTML = '';
            lotCell.contentEditable = true;
        }
    } else {
        let lotSelect = lotCell.querySelector('select');
        if (!lotSelect) {
            lotSelect = document.createElement('select');
            lotSelect.appendChild(new Option('', ''));
            lotSelect.addEventListener('change', handleLotSelection);
            lotCell.innerHTML = '';
            lotCell.appendChild(lotSelect);
            lotCell.contentEditable = false;
        }
        updateLotOptions(lotSelect, skuName);
    }

    const countCell = tr.children[4];
    if (!countCell.textContent) {
        countCell.textContent = "1";
    }
}

function processSkuRow(td) {
    const tr = td.parentElement;
    const inputValue = td.textContent.trim();
    const skuName = resolveSkuFromInput(inputValue);

    if (!skuName) return;

    const existingRow = findExistingSkuRow(skuName, tr);
    if (existingRow) {
        const countCell = existingRow.children[4];
        countCell.textContent = (parseInt(countCell.textContent, 10) || 0) + 1;
        clearRetailScanRow(tr);
        focusNextEmptySkuCell();
        checkForEmptyRow();
        return;
    }

    setupNewRetailRow(tr, td, skuName);
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
                    template: 'retail'
                })
            });
        }
    }
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
        localStorage.removeItem('picklistState');
        renderTable();
    }
}); 