// Load data when the page is loaded
window.onload = async () => {
    await loadLotCodes();
    renderTable();
    addFormattingToExistingCells();
};

window.renderTable = renderTable;

function renderTable() {
    const tbody = document.getElementById("excel-table");
    tbody.innerHTML = "";

    const minRows = 13;
    for (let i = 0; i < minRows; i++) {
        tbody.appendChild(createRow());
    }

    addCountCellListeners();
}

function createRow() {
    const tr = document.createElement("tr");

    const skuTd = document.createElement("td");
    createSkuInput(skuTd, (scannedValue) => processSkuRow(skuTd, scannedValue));
    tr.appendChild(skuTd);

    const lotTd = document.createElement("td");
    const lotSelect = document.createElement("select");
    lotSelect.appendChild(new Option("", ""));
    lotSelect.addEventListener("change", handleLotSelection);
    lotTd.appendChild(lotSelect);
    tr.appendChild(lotTd);

    const bbTd = document.createElement("td");
    bbTd.contentEditable = true;
    addCellFormatting(bbTd);
    tr.appendChild(bbTd);

    const umTd = document.createElement("td");
    umTd.contentEditable = true;
    addCellFormatting(umTd);
    tr.appendChild(umTd);

    const countTd = document.createElement("td");
    countTd.contentEditable = true;
    addCellFormatting(countTd);
    tr.appendChild(countTd);

    return tr;
}

function addCellFormatting(cell) {
    cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });

    cell.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const normalizedText = text.replace(/\s+/g, ' ').trim();
        document.execCommand('insertText', false, normalizedText);
    });

    cell.addEventListener('blur', () => {
        const normalizedText = cell.textContent.replace(/\s+/g, ' ').trim();
        cell.textContent = normalizedText;
    });
}

function addFormattingToExistingCells() {
    document.querySelectorAll('[contenteditable="true"]').forEach(cell => {
        addCellFormatting(cell);
    });
}

window.reattachSkuListeners = function() {
    document.querySelectorAll('#excel-table tr').forEach(tr => {
        const skuTd = tr.children[0];
        if (!skuTd || skuTd.dataset.scanBound === '1') return;
        createSkuInput(skuTd, (scannedValue) => processSkuRow(skuTd, scannedValue));
    });
};

function shouldUseSet(sku) {
    const upperSku = sku.toUpperCase();
    return upperSku.startsWith("DB") || upperSku.startsWith("PR-INT-CS");
}

function clearRetailScanRow(tr) {
    Array.from(tr.children).forEach((cell, idx) => {
        if (idx === 0) {
            setSkuCellText(cell, '');
        } else if (idx === 1) {
            const lotSelect = document.createElement('select');
            lotSelect.appendChild(new Option('', ''));
            lotSelect.addEventListener('change', handleLotSelection);
            cell.innerHTML = '';
            cell.appendChild(lotSelect);
        } else {
            cell.textContent = '';
        }
    });
}

function setupNewRetailRow(tr, skuTd, skuName) {
    setSkuCellText(skuTd, skuName);

    const umCell = tr.children[3];
    if (skuName.toUpperCase().startsWith("WH")) {
        umCell.textContent = "CS";
    } else {
        umCell.textContent = shouldUseSet(skuName) ? "Set" : "EA";
    }

    const lotCell = tr.children[1];
    if (skuName.toUpperCase().startsWith("WH")) {
        lotCell.innerHTML = '';
        lotCell.contentEditable = true;
    } else {
        const lotSelect = document.createElement('select');
        lotSelect.appendChild(new Option('', ''));
        lotSelect.addEventListener('change', handleLotSelection);
        lotCell.innerHTML = '';
        lotCell.appendChild(lotSelect);
        lotCell.contentEditable = false;
        updateLotOptions(lotSelect, skuName);
    }

    const countCell = tr.children[4];
    if (!countCell.textContent) {
        countCell.textContent = "1";
    }
}

function processSkuRow(skuTd, scannedValue) {
    const tr = skuTd.parentElement;
    const raw = scannedValue !== undefined ? scannedValue : getSkuCellText(skuTd);
    const skuName = resolveSkuFromInput(raw);

    if (!skuName) return;

    const existingRow = findSkuRow(skuName);
    if (existingRow) {
        const countCell = existingRow.children[4];
        const nextCount = (parseInt(countCell.textContent, 10) || 0) + 1;
        countCell.textContent = String(nextCount);

        if (existingRow !== tr) {
            clearRetailScanRow(tr);
        } else {
            setSkuCellText(skuTd, skuName);
        }

        focusNextEmptySkuCell();
        checkForEmptyRow();
        return;
    }

    setupNewRetailRow(tr, skuTd, skuName);
    checkForEmptyRow();
}

function handleLotSelection(event) {
    const select = event.target;
    const tr = select.closest("tr");
    const selectedLot = select.value;
    const skuName = getSkuCellText(tr.children[0]).trim();
    const bbCell = tr.children[2];

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

    const rows = document.querySelectorAll('#excel-table tr');
    for (const row of rows) {
        const cells = row.children;
        const sku = getSkuCellText(cells[0]).trim();
        const lotSelect = cells[1].querySelector('select');
        const lotCode = lotSelect ? lotSelect.value : cells[1].textContent.trim();
        const quantity = cells[4]?.textContent.trim();
        const unit = cells[3]?.textContent.trim();
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

document.getElementById('clearButton').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all entries? This cannot be undone.')) {
        document.querySelectorAll('.order-info [contenteditable]').forEach(element => {
            element.textContent = '';
        });

        const tbody = document.getElementById("excel-table");
        tbody.innerHTML = '';
        localStorage.removeItem('picklistState');
        renderTable();
    }
});
