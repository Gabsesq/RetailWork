// const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
//     ? 'http://127.0.0.1:5000'
//     : 'https://retailpr-f15aaf777d4b.herokuapp.com';

// Only declare SKUMAP if it doesn't already exist
if (typeof window.SKUMAP === 'undefined') {
    window.SKUMAP = {
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
}

window.LOT_CODES = {}; // Will be populated from JSON

// Shared utility functions
function normalizeSkuName(sku) {
    if (!sku) return '';
    // Convert to uppercase and remove all spaces and special characters
    let normalized = sku.toUpperCase().replace(/[\s&-]/g, '');
    // Special case for 2in1
    if (normalized === '2IN1SKCT') {
        normalized = '2 IN 1-SK-CT';
    }
    // Special case for TS-Itchy-Dry
    if (normalized === 'TSITCHYDRYSHAMPOO') {
        normalized = 'TS-ITCHY&DRYSHAMPOO';
    }
    return normalized;
}

async function loadLotCodes() {
    try {
        const response = await fetch('/js/lot_codes.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        window.LOT_CODES = await response.json();
        console.log("Successfully loaded lot codes:", Object.keys(window.LOT_CODES).length);
        return true;
    } catch (error) {
        console.error("Error loading lot codes:", error);
        return false;
    }
}

// Make updateLotOptions a global function
window.updateLotOptions = function(select, sku) {
    if (!window.LOT_CODES || Object.keys(window.LOT_CODES).length === 0) {
        console.error("Lot codes not loaded properly");
        // Try to reload lot codes
        loadLotCodes().then(() => {
            // Retry updating options after reload
            updateLotOptions(select, sku);
        });
        return;
    }

    console.log("\nUpdating lot options for:", sku);
    console.log("Available lot codes:", Object.keys(window.LOT_CODES).length);
    
    select.innerHTML = "";
    select.appendChild(new Option("", ""));
    
    if (!sku) return;
    
    let skuName = sku;
    if (sku.length === 12 && sku.startsWith('8')) {
        skuName = SKUMAP[sku] || sku;
        console.log("Converted barcode to SKU name:", skuName);
    }
    
    const normalizedInputSku = normalizeSkuName(skuName);
    console.log("Normalized SKU:", normalizedInputSku);
    
    const matchingSku = Object.keys(window.LOT_CODES).find(key => 
        normalizeSkuName(key) === normalizedInputSku
    );
    
    console.log("Matching SKU found:", matchingSku);
    
    if (matchingSku && window.LOT_CODES[matchingSku]) {
        const sortedLots = Object.keys(window.LOT_CODES[matchingSku]).sort();
        console.log("Available lots with BB dates:");
        sortedLots.forEach(lot => {
            const bbDate = window.LOT_CODES[matchingSku][lot].bb_date;
            console.log(`  ${lot}: ${bbDate}`);
            select.appendChild(new Option(lot, lot));
        });
    }
};

// Shared functionality
function checkForEmptyRow() {
    const tbody = document.getElementById("excel-table");
    const rows = tbody.getElementsByTagName("tr");
    
    // Don't add new rows if we already have plenty
    if (rows.length >= 50) return;  // Set a reasonable maximum
    
    const lastRow = rows[rows.length - 1];
    let hasContent = false;
    Array.from(lastRow.children).forEach(cell => {
        if (cell.querySelector('select')) {
            if (cell.querySelector('select').value) hasContent = true;
        } else if (cell.textContent.trim()) {
            if (cell !== lastRow.children[2] || cell.textContent.trim() !== "EA") {
                hasContent = true;
            }
        }
    });

    if (hasContent) {
        const newRow = createRow();
        tbody.appendChild(newRow);
    }
}

function addCountCellListeners() {
    const tbody = document.getElementById("excel-table");
    const rows = tbody.getElementsByTagName("tr");
    
    Array.from(rows).forEach(row => {
        const countCell = row.children[3]; // CNT1/COUNT column
        countCell.addEventListener('input', () => {
            updateTotals();
        });
    });
}

// Add required class handling for SO number
document.querySelector('.so-number-box')?.addEventListener('input', function() {
    if (this.textContent.trim()) {
        this.classList.remove('required');
    }
});

// Add these functions to constants.js
function saveState() {
    const tbody = document.getElementById("excel-table");
    const orderInfo = document.querySelectorAll('.order-info [contenteditable]');
    const tableFooter = document.querySelectorAll('.table-footer [contenteditable]');
    
    const state = {
        tableHtml: tbody.innerHTML,
        orderInfo: Array.from(orderInfo).map(el => ({
            id: el.className,
            content: el.textContent
        })),
        tableFooter: Array.from(tableFooter).map(el => ({
            path: getElementPath(el),
            content: el.textContent
        })),
        timestamp: new Date().getTime()
    };
    
    localStorage.setItem('picklistState', JSON.stringify(state));
}

function restoreState() {
    const savedState = localStorage.getItem('picklistState');
    if (!savedState) return;
    
    try {
        const state = JSON.parse(savedState);
        // Only restore if the state is less than 8 hours old
        if (new Date().getTime() - state.timestamp < 8 * 60 * 60 * 1000) {
            const tbody = document.getElementById("excel-table");
            tbody.innerHTML = state.tableHtml;
            
            // Restore order info
            state.orderInfo.forEach(item => {
                const el = document.querySelector(`.${item.id}`);
                if (el) el.textContent = item.content;
            });
            
            // Restore table footer
            state.tableFooter.forEach(item => {
                const el = document.querySelector(item.path);
                if (el) el.textContent = item.content;
            });
            
            // Reattach event listeners
            addCountCellListeners();
            if (window.addUmCellListeners) addUmCellListeners();
            if (window.addPalletCellListeners) addPalletCellListeners();
        } else {
            localStorage.removeItem('picklistState');
        }
    } catch (error) {
        console.error('Error restoring state:', error);
    }
}

// Helper function to get unique element path
function getElementPath(el) {
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
            selector += "#" + el.id;
        } else {
            let sib = el, nth = 1;
            while (sib.previousElementSibling) {
                sib = sib.previousElementSibling;
                nth++;
            }
            selector += ":nth-child(" + nth + ")";
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(" > ");
}

// Auto-save every 5 seconds
setInterval(saveState, 5000);

// Add this to prevent accidental navigation
window.addEventListener('beforeunload', (e) => {
    const tbody = document.getElementById("excel-table");
    if (tbody.getElementsByTagName("tr").length > 1 && 
        Array.from(tbody.getElementsByTagName("td")).some(td => td.textContent.trim())) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Add at the top of constants.js
window.addEventListener('online', function() {
    console.log('Network connection restored');
    loadLotCodes(); // Reload lot codes when connection is restored
});

window.addEventListener('offline', function() {
    console.log('Network connection lost');
}); 