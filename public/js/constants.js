const SKUMAP = {
    "860009592568": "Post-Bio-GH",
    "860009592551": "Omega-Alg",
    "850016364982": "Edi-DR-BC-SML",
    "864178000275": "Edi-DR-BC-LRG",
    "850016364968": "TS-Edi-HJ-PB",
    "850016364876": "Edi-HJ-PB-SML",
    "850016364883": "Edi-HJ-PB-LRG",
    "850016364890": "Edi-HJ-PB-FAM",
    "850016364951": "TS-Edi-STRESS-PB",
    "850016364838": "Edi-STRESS-PB-SML",
    "850016364852": "Edi-STRESS-PB-LRG",
    "850016364869": "Edi-STRESS-PB-FAM",
    "850016364906": "Edi-DR-SP-SML",
    "850016364913": "Edi-DR-SP-LRG",
    "850016364944": "TS-Edi-STRESS-Pepp",
    "850016364845": "Edi-STRESS-Pepp-SML",
    "850016364821": "Edi-STRESS-Pepp-LRG",
    "860009592599": "Edi-STRESS-Pepp-FAM",
    "860008203403": "100-DR-HO",
    "860008203410": "200-DR-HO",
    "860008203427": "500-DR-HO",
    "860008203434": "750-DR-HO",
    "860009592575": "150-Mini-Stress-HO",
    "860008203441": "300-SR-HO",
    "860008203458": "600-SR-HO",
    "860008203465": "300-HJR-HO",
    "860008203472": "600-HJR-HO",
    "860008221988": "180-CAT-SR",
    "860008876775": "100-Lipe-Ultra",
    "860008876768": "300-Lipe-Ultra",
    "860009592513": "600-Lipe-Ultra",
    "861109000304": "CAP450",
    "850016364586": "SNT30",
    "860009592537": "TS-Itchy-Dry-Shampoo",
    "860008876713": "Itchy & Dry-SK-CT",
    "860009592520": "Itchy-Dry-Shampoo-Gallon",
    "860008876720": "Sensitive-SK-CT",
    "860008876737": "Conditioner-SK-CT",
    "860009592544": "TS-2in1-Shampoo",
    "860008876744": "2in1-SK-CT",
    "860008221971": "SK-PW-RL",
};

window.LOT_CODES = {};
window.picklistNextScanNewLine = false;

function normalizeSkuName(sku) {
    if (!sku) return '';
    let normalized = sku.toUpperCase().replace(/[\s&-]/g, '');
    if (normalized === '2IN1SKCT') normalized = '2 IN 1-SK-CT';
    if (normalized === 'TSITCHYDRYSHAMPOO') normalized = 'TS-ITCHY&DRYSHAMPOO';
    return normalized;
}

async function loadLotCodes() {
    try {
        const response = await fetch('/js/lot_codes.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        window.LOT_CODES = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading lot codes:', error);
        return false;
    }
}

window.updateLotOptions = function(select, sku) {
    if (!window.LOT_CODES || Object.keys(window.LOT_CODES).length === 0) {
        loadLotCodes().then(() => updateLotOptions(select, sku));
        return;
    }

    select.innerHTML = '';
    select.appendChild(new Option('', ''));

    if (!sku) return;

    let skuName = sku;
    if (sku.length === 12 && sku.startsWith('8')) {
        skuName = SKUMAP[sku] || sku;
    }

    const normalizedInputSku = normalizeSkuName(skuName);
    const matchingSku = Object.keys(window.LOT_CODES).find(key =>
        normalizeSkuName(key) === normalizedInputSku
    );

    if (matchingSku && window.LOT_CODES[matchingSku]) {
        Object.keys(window.LOT_CODES[matchingSku]).sort().forEach(lot => {
            select.appendChild(new Option(lot, lot));
        });
    }
};

function extractScanDigits(text) {
    return (text || '').replace(/\D/g, '');
}

function getSkuCellText(skuTd) {
    const input = skuTd.querySelector('input.sku-input');
    if (input) return input.value;
    return skuTd.textContent || '';
}

function setSkuCellText(skuTd, text) {
    const input = skuTd.querySelector('input.sku-input');
    if (input) {
        input.value = text;
        return;
    }
    skuTd.textContent = text;
}

function focusSkuCell(skuTd) {
    const input = skuTd.querySelector('input.sku-input');
    if (input) input.focus();
    else skuTd.focus();
}

function resolveSkuFromInput(inputValue, allowAnyScan) {
    const v = (inputValue || '').trim();
    if (!v) return null;

    const digits = extractScanDigits(v);
    if (digits.length === 13 && digits.startsWith('1') && digits.substring(1).startsWith('8')) {
        const barcode = digits.substring(1);
        return SKUMAP[barcode] || (allowAnyScan ? v : null);
    }
    if (digits.length === 12 && digits.startsWith('8')) {
        return SKUMAP[digits] || (allowAnyScan ? v : null);
    }

    return v;
}

function skuRowMatchesName(row, skuName) {
    const text = getSkuCellText(row.children[0]).trim();
    if (!text) return false;
    const normalized = normalizeSkuName(skuName);
    return normalizeSkuName(text) === normalized || text === skuName;
}

function findSkuRow(skuName, currentTr) {
    const rows = Array.from(document.querySelectorAll('#excel-table tr'));
    let found = null;

    for (const row of rows) {
        if (currentTr && row === currentTr && !getSkuCellText(row.children[0]).trim()) {
            continue;
        }
        if (skuRowMatchesName(row, skuName)) {
            found = row;
        }
    }
    return found;
}

// Prefer the row that already has count/lot set; otherwise the first matching row.
function findMergeTargetRow(skuName, currentTr) {
    const rows = Array.from(document.querySelectorAll('#excel-table tr'));
    let firstMatch = null;
    let lastCommitted = null;

    for (const row of rows) {
        if (currentTr && row === currentTr && !getSkuCellText(row.children[0]).trim()) {
            continue;
        }
        if (!skuRowMatchesName(row, skuName)) continue;
        if (!firstMatch) firstMatch = row;
        if (isPicklistRowCommitted(row)) lastCommitted = row;
    }

    return lastCommitted || firstMatch;
}

function findEmptySkuRow() {
    for (const row of document.querySelectorAll('#excel-table tr')) {
        const skuCell = row.children[0];
        if (skuCell && !getSkuCellText(skuCell).trim()) {
            return row;
        }
    }
    return null;
}

function focusNextEmptySkuCell() {
    for (const row of document.querySelectorAll('#excel-table tr')) {
        const skuCell = row.children[0];
        if (skuCell && !getSkuCellText(skuCell).trim()) {
            focusSkuCell(skuCell);
            return;
        }
    }
}

function isPicklistRowCommitted(tr) {
    const sku = getSkuCellText(tr.children[0]).trim();
    if (!sku) return false;
    const count =
        parseInt(tr.children[4]?.textContent, 10) ||
        parseInt(tr.children[3]?.textContent, 10) ||
        0;
    return count > 0;
}

function isCompleteBarcodeScan(value) {
    const v = extractScanDigits(value);
    return /^\d{12}$/.test(v) && v.startsWith('8');
}

function isCompleteScanValue(value) {
    const v = extractScanDigits(value);
    if (/^\d{12}$/.test(v) && v.startsWith('8')) return true;
    if (/^\d{13}$/.test(v) && v.startsWith('1') && v.substring(1).startsWith('8')) return true;
    return false;
}

function tryAcquirePicklistScan() {
    if (window.__picklistScanBusy) return false;
    window.__picklistScanBusy = true;
    setTimeout(() => {
        window.__picklistScanBusy = false;
    }, 900);
    return true;
}

function safeClearScanRow(config, tr) {
    if (isPicklistRowCommitted(tr)) return;
    config.clearScanRow(tr);
}

function setNewLineHintVisible(visible) {
    const btn = document.getElementById('newLineBtn');
    const hint = document.getElementById('newLineHint');
    if (btn) btn.classList.toggle('active', visible);
    if (hint) hint.hidden = !visible;
}

function armNextScanAsNewLine() {
    window.picklistNextScanNewLine = true;
    setNewLineHintVisible(true);
    if (typeof window.refocusWarehouseScan === 'function') {
        window.refocusWarehouseScan();
    } else {
        focusNextEmptySkuCell();
    }
}

// One scan handler for retail + warehouse.
function handleSkuScan(skuTd, scannedValue, config, scanOptions) {
    const tr = skuTd.parentElement;
    const inputValue = (scannedValue !== undefined ? scannedValue : getSkuCellText(skuTd)).trim();

    if (!inputValue) {
        if (config.onClearRow) config.onClearRow(tr, skuTd);
        return;
    }

    const skuName = resolveSkuFromInput(inputValue, config.allowAnyScan);
    if (!skuName) return;

    const opts = scanOptions || {};
    const forceNewLine = !!opts.forceNewLine;
    const scanRowEmpty = !!opts.scanRowWasEmpty;

    if (
        !forceNewLine &&
        window.__blockMergeForSku === skuName &&
        Date.now() < window.__blockMergeUntil
    ) {
        return;
    }

    if (forceNewLine) {
        window.picklistNextScanNewLine = false;
        setNewLineHintVisible(false);
        window.__blockMergeForSku = skuName;
        window.__blockMergeUntil = Date.now() + 1200;

        let targetTr = findEmptySkuRow() || tr;
        let targetSkuTd = targetTr.children[0];
        config.setupRow(targetTr, targetSkuTd, skuName);

        if (targetTr !== tr) {
            safeClearScanRow(config, tr);
        }

        config.onAfterScan();
        return;
    }

    const mergeTarget = findMergeTargetRow(skuName, tr);

    if (mergeTarget && isPicklistRowCommitted(mergeTarget)) {
        const countCell = mergeTarget.children[config.countCol];
        countCell.textContent = String((parseInt(countCell.textContent, 10) || 0) + 1);
        if (mergeTarget !== tr) {
            safeClearScanRow(config, tr);
        }
        config.onAfterScan();
        return;
    }

    let targetTr = tr;
    let targetSkuTd = skuTd;

    if (mergeTarget && scanRowEmpty && !isPicklistRowCommitted(mergeTarget)) {
        targetTr = mergeTarget;
        targetSkuTd = mergeTarget.children[0];
    } else if (!scanRowEmpty && isPicklistRowCommitted(tr)) {
        const emptyRow = findEmptySkuRow();
        if (emptyRow) {
            targetTr = emptyRow;
            targetSkuTd = emptyRow.children[0];
        }
    }

    config.setupRow(targetTr, targetSkuTd, skuName);

    if (targetTr !== tr) {
        safeClearScanRow(config, tr);
    }

    config.onAfterScan();
}

// True when field is only digits and still building a 12/13-digit UPC (not a name like 150-Mini-...).
function isPartialBarcodeOnly(value) {
    const v = (value || '').trim();
    if (/[A-Za-z]/.test(v)) return false;
    const digits = extractScanDigits(v);
    if (!digits || digits !== v) return false;
    if (digits.startsWith('8') && digits.length < 12) return true;
    if (digits.startsWith('1') && digits.length > 1 && digits.length < 13) return true;
    return false;
}

function canCommitWarehouseSku(value) {
    const v = (value || '').trim();
    if (!v) return false;
    if (isCompleteScanValue(v)) return true;
    if (isPartialBarcodeOnly(v)) return false;
    if (/[A-Za-z]/.test(v)) {
        // e.g. 600-SR-HO, 300-SR-HO (9 chars) — must commit when name is complete
        if (v.includes('-')) return v.length >= 9;
        return v.length >= 3;
    }
    return true;
}

function createSkuInput(skuTd, onScanComplete, options) {
    const allowNameScans = options && options.allowNameScans;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sku-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('name', 'sku-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');

    let scanLock = false;

    const finish = () => {
        if (scanLock) return;

        const value = input.value.trim();
        if (!value) return;
        if (allowNameScans && !canCommitWarehouseSku(value)) return;
        if (!tryAcquirePicklistScan()) return;

        clearTimeout(input._whScanTimer);

        const tr = skuTd.parentElement;
        const scanRowWasEmpty = !isPicklistRowCommitted(tr);
        const forceNewLine = !!window.picklistNextScanNewLine;
        if (forceNewLine) {
            window.picklistNextScanNewLine = false;
            setNewLineHintVisible(false);
        }

        scanLock = true;
        input.value = '';
        onScanComplete(value, { forceNewLine, scanRowWasEmpty });

        setTimeout(() => {
            scanLock = false;
        }, 600);
    };

    input.addEventListener('input', () => {
        const value = input.value.trim();
        if (!value) return;

        if (isCompleteScanValue(value)) {
            clearTimeout(input._whScanTimer);
            input._whScanTimer = setTimeout(() => {
                if (scanLock) return;
                const v = input.value.trim();
                if (!isCompleteScanValue(v)) return;
                finish();
            }, 80);
            return;
        }

        if (!allowNameScans) return;

        clearTimeout(input._whScanTimer);
        input._whScanTimer = setTimeout(() => {
            if (scanLock) return;
            const v = input.value.trim();
            if (!canCommitWarehouseSku(v)) return;
            finish();
        }, 400);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(input._whScanTimer);
            finish();
        }
    });

    skuTd.appendChild(input);
    skuTd.dataset.scanBound = '1';
}

function checkForEmptyRow() {
    const tbody = document.getElementById('excel-table');
    if (!tbody || tbody.rows.length >= 50) return;

    const lastRow = tbody.rows[tbody.rows.length - 1];
    let hasContent = false;

    Array.from(lastRow.cells).forEach((cell, idx) => {
        if (cell.querySelector('select')?.value) hasContent = true;
        else if (idx === 0 && getSkuCellText(cell).trim()) hasContent = true;
        else if (cell.textContent.trim()) hasContent = true;
    });

    if (hasContent && window.createPicklistRow) {
        tbody.appendChild(window.createPicklistRow());
    }
}

document.querySelector('.so-number-box')?.addEventListener('input', function() {
    if (this.textContent.trim()) {
        this.classList.remove('required');
    }
});

window.picklistAllowUnload = false;

function picklistHasProgress() {
    if (window.picklistAllowUnload) return false;

    for (const row of document.querySelectorAll('#excel-table tr')) {
        if (getSkuCellText(row.children[0]).trim()) return true;
        const lotSelect = row.children[1]?.querySelector('select');
        if (lotSelect?.value) return true;
    }

    if (document.querySelector('.so-number-box')?.textContent.trim()) return true;

    for (const el of document.querySelectorAll('.order-info [contenteditable], .table-footer [contenteditable]')) {
        if (el.textContent.trim()) return true;
    }

    return false;
}

window.allowLeavePicklist = function() {
    window.picklistAllowUnload = true;
};

window.addEventListener('beforeunload', function(e) {
    if (!picklistHasProgress()) return;
    e.preventDefault();
    e.returnValue = '';
});

function clearPicklistStorage() {
    try {
        localStorage.removeItem('picklistState');
        sessionStorage.removeItem('picklistState');
    } catch (e) {
        // ignore private mode / storage errors
    }
}

// Handheld browsers often restore the whole page from cache (bfcache) with old table data.
window.resetPicklistPage = function() {
    clearPicklistStorage();
    window.picklistAllowUnload = true;
    window.picklistNextScanNewLine = false;
    window.__blockMergeForSku = null;
    window.__blockMergeUntil = 0;
    setNewLineHintVisible(false);

    document.querySelectorAll('.order-info [contenteditable], .table-footer [contenteditable]').forEach(el => {
        el.textContent = '';
    });

    if (typeof window.renderTable === 'function') {
        window.renderTable();
    }
    if (typeof window.setupWarehouseScanBar === 'function') {
        window.setupWarehouseScanBar();
    }
};

window.addEventListener('pageshow', function(event) {
    clearPicklistStorage();
    if (event.persisted) {
        window.resetPicklistPage();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    clearPicklistStorage();
    const btn = document.getElementById('newLineBtn');
    if (btn) btn.addEventListener('click', armNextScanAsNewLine);
});
