// Same lot = merge scans into existing SKU row. New lot = always start a new line.
window.PicklistLotMode = {
    SAME_LOT: 'same-lot',
    NEW_LOT: 'new-lot',
    current: 'same-lot',

    isNewLot() {
        return this.current === this.NEW_LOT;
    },

    setMode(mode) {
        this.current = mode === this.NEW_LOT ? this.NEW_LOT : this.SAME_LOT;
        this.updateUI();
    },

    updateUI() {
        const sameBtn = document.getElementById('sameLotBtn');
        const newBtn = document.getElementById('newLotBtn');
        const banner = document.getElementById('newLotBanner');
        const bar = document.getElementById('lotModeBar');

        if (!sameBtn || !newBtn) return;

        const isNew = this.isNewLot();
        sameBtn.classList.toggle('active', !isNew);
        newBtn.classList.toggle('active', isNew);
        if (bar) bar.classList.toggle('lot-mode-bar--new-lot', isNew);
        if (banner) banner.hidden = !isNew;
    },

    init() {
        const sameBtn = document.getElementById('sameLotBtn');
        const newBtn = document.getElementById('newLotBtn');
        if (!sameBtn || !newBtn) return;

        sameBtn.addEventListener('click', () => this.setMode(this.SAME_LOT));
        newBtn.addEventListener('click', () => this.setMode(this.NEW_LOT));
        this.updateUI();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    PicklistLotMode.init();
});
