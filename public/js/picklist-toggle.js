(function () {
    const toggle = document.getElementById('modeToggle');
    if (!toggle) return;

    toggle.addEventListener('change', function () {
        window.location.href = toggle.checked ? '/warehouse.html' : '/retail.html';
    });
})();
