window.renderTable = renderTable;
window.createPicklistRow = createRow;

window.onload = async () => {
    await loadLotCodes();
    renderTable();
};

function renderTable() {
    const tbody = document.getElementById('excel-table');
    tbody.innerHTML = '';

    for (let i = 0; i < 13; i++) {
        tbody.appendChild(createRow());
    }
}

function createRow() {
    const tr = document.createElement('tr');

    const skuTd = document.createElement('td');
    createSkuInput(skuTd, (value) => processSkuRow(skuTd, value));
    tr.appendChild(skuTd);

    const lotTd = document.createElement('td');
    const lotSelect = document.createElement('select');
    lotSelect.appendChild(new Option('', ''));
    lotSelect.addEventListener('change', handleLotSelection);
    lotTd.appendChild(lotSelect);
    tr.appendChild(lotTd);

    const bbTd = document.createElement('td');
    bbTd.contentEditable = true;
    tr.appendChild(bbTd);

    const umTd = document.createElement('td');
    umTd.contentEditable = true;
    tr.appendChild(umTd);

    const countTd = document.createElement('td');
    countTd.contentEditable = true;
    tr.appendChild(countTd);

    return tr;
}

function shouldUseSet(sku) {
    const upperSku = sku.toUpperCase();
    return upperSku.startsWith('DB') || upperSku.startsWith('PR-INT-CS');
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

function setupRetailRow(tr, skuTd, skuName) {
    setSkuCellText(skuTd, skuName);

    const umCell = tr.children[3];
    umCell.textContent = skuName.toUpperCase().startsWith('WH')
        ? 'CS'
        : (shouldUseSet(skuName) ? 'Set' : 'EA');

    const lotCell = tr.children[1];
    if (skuName.toUpperCase().startsWith('WH')) {
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

    tr.children[4].textContent = '1';
}

function processSkuRow(skuTd, scannedValue) {
    handleSkuScan(skuTd, scannedValue, {
        countCol: 4,
        setupRow: setupRetailRow,
        clearScanRow: clearRetailScanRow,
        onClearRow: (tr) => clearRetailScanRow(tr),
        onAfterScan: checkForEmptyRow
    });
}

function handleLotSelection(event) {
    const select = event.target;
    const tr = select.closest('tr');
    const skuName = getSkuCellText(tr.children[0]).trim();
    const bbCell = tr.children[2];
    const matchingSku = Object.keys(LOT_CODES).find(key =>
        normalizeSkuName(key) === normalizeSkuName(skuName)
    );

    if (select.value && matchingSku && LOT_CODES[matchingSku]?.[select.value]) {
        bbCell.textContent = LOT_CODES[matchingSku][select.value].bb_date;
    } else {
        bbCell.textContent = '';
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

    for (const row of document.querySelectorAll('#excel-table tr')) {
        const cells = row.children;
        const sku = getSkuCellText(cells[0]).trim();
        const lotSelect = cells[1].querySelector('select');
        const lotCode = lotSelect ? lotSelect.value : cells[1].textContent.trim();
        if (!sku || !lotCode) continue;

        await fetch('/api/lots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                soNumber,
                sku,
                lotCode,
                quantity: cells[4].textContent.trim(),
                unit: cells[3].textContent.trim(),
                template: 'retail'
            })
        });
    }
    window.print();
});

document.getElementById('clearButton').addEventListener('click', function() {
    if (!confirm('Clear all entries? This cannot be undone.')) return;

    allowLeavePicklist();
    window.picklistNextScanNewLine = false;
    setNewLineHintVisible(false);

    document.querySelectorAll('.order-info [contenteditable]').forEach(el => {
        el.textContent = '';
    });

    renderTable();
});
