window.renderTable = renderTable;
window.createPicklistRow = createRow;

window.onload = async () => {
    clearPicklistStorage();
    renderTable();
    setupWarehouseScanBar();
    loadLotCodes();
};

function renderTable() {
    const tbody = document.getElementById('excel-table');
    if (!tbody) return;

    tbody.innerHTML = '';
    for (let i = 0; i < 13; i++) {
        tbody.appendChild(createRow());
    }
    updateTotals();
}

function createRow() {
    const tr = document.createElement('tr');

    const skuTd = document.createElement('td');
    tr.appendChild(skuTd);

    const lotTd = document.createElement('td');
    lotTd.contentEditable = true;
    tr.appendChild(lotTd);

    const umTd = document.createElement('td');
    umTd.contentEditable = true;
    tr.appendChild(umTd);

    const countTd = document.createElement('td');
    countTd.contentEditable = true;
    countTd.addEventListener('input', () => updateTotals());
    tr.appendChild(countTd);

    const pallet1Td = document.createElement('td');
    pallet1Td.contentEditable = true;
    tr.appendChild(pallet1Td);

    const pallet2Td = document.createElement('td');
    pallet2Td.contentEditable = true;
    tr.appendChild(pallet2Td);

    return tr;
}

function getWarehouseScanAnchor() {
    const emptyRow = findEmptySkuRow();
    if (emptyRow) return emptyRow.children[0];
    const first = document.querySelector('#excel-table tr');
    return first ? first.children[0] : null;
}

function setupWarehouseScanBar() {
    const host = document.getElementById('warehouseScanHost');
    if (!host) return;

    host.innerHTML = '';
    const anchor = document.createElement('div');
    anchor.className = 'warehouse-scan-anchor';
    host.appendChild(anchor);

    createSkuInput(anchor, (value, scanOpts) => {
        const skuTd = getWarehouseScanAnchor();
        if (!skuTd) return;
        processSkuRow(skuTd, value, { ...scanOpts, scanRowWasEmpty: true });
    }, { allowNameScans: true });

    window.refocusWarehouseScan = function() {
        const input = host.querySelector('input.sku-input');
        if (input) {
            setTimeout(() => input.focus(), 0);
        }
    };

    window.refocusWarehouseScan();
}

function clearWarehouseScanRow(tr) {
    if (isPicklistRowCommitted(tr)) return;

    Array.from(tr.children).forEach((cell, idx) => {
        if (idx === 0) {
            cell.innerHTML = '';
            cell.textContent = '';
        } else {
            cell.textContent = '';
            cell.contentEditable = true;
        }
    });
}

function setupWarehouseRow(tr, skuTd, skuName) {
    skuTd.innerHTML = '';
    skuTd.textContent = skuName;

    tr.children[2].textContent = 'CS';

    const lotSelect = document.createElement('select');
    lotSelect.appendChild(new Option('', ''));
    lotSelect.addEventListener('change', () => {
        tr.children[2].textContent = 'CS';
    });

    const lotCell = tr.children[1];
    lotCell.innerHTML = '';
    lotCell.appendChild(lotSelect);
    lotCell.contentEditable = false;
    updateLotOptions(lotSelect, skuName);

    tr.children[3].textContent = '1';
}

function processSkuRow(skuTd, scannedValue, scanOptions) {
    handleSkuScan(skuTd, scannedValue, {
        countCol: 3,
        allowAnyScan: true,
        setupRow: setupWarehouseRow,
        clearScanRow: clearWarehouseScanRow,
        onClearRow: (tr, cell) => {
            clearWarehouseScanRow(tr);
            updateTotals();
        },
        onAfterScan: () => {
            updateTotals();
            checkForEmptyRow();
            if (typeof window.refocusWarehouseScan === 'function') {
                window.refocusWarehouseScan();
            }
        }
    }, scanOptions);
}

function updateTotals() {
    const tbody = document.getElementById('excel-table');
    if (!tbody) return;

    let total = 0;
    let pallet1Total = 0;
    let pallet2Total = 0;

    Array.from(tbody.rows).forEach(row => {
        if (!getSkuCellText(row.children[0]).trim()) return;

        const count = parseInt(row.children[3].textContent, 10) || 0;
        total += count;
        if (row.children[4].textContent.trim()) pallet1Total += count;
        if (row.children[5].textContent.trim()) pallet2Total += count;
    });

    const shipped = document.querySelector('.totals div:first-child span');
    const confirmed = document.querySelector('.totals div:last-child span');
    const pallet1 = document.querySelector('.signatures div div:first-child span');
    const pallet2 = document.querySelector('.signatures div div:last-child span');

    if (shipped) shipped.textContent = total;
    if (confirmed) confirmed.textContent = total;
    if (pallet1) pallet1.textContent = pallet1Total;
    if (pallet2) pallet2.textContent = pallet2Total;
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
                quantity: cells[3].textContent.trim(),
                unit: cells[2].textContent.trim(),
                template: 'warehouse'
            })
        });
    }
    window.print();
});

window.setupWarehouseScanBar = setupWarehouseScanBar;

document.getElementById('clearButton').addEventListener('click', function() {
    if (!confirm('Clear all entries? This cannot be undone.')) return;
    window.resetPicklistPage();
});
