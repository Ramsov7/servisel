/* navigation.js — header, bottom-nav interactions */

(function () {
    const headerSearch = document.getElementById('header-search');
    const headerDropdowns = document.getElementById('header-dropdowns');
    const bottomNav = document.querySelector('.bottom-nav');
    const navButtons = bottomNav ? bottomNav.querySelectorAll('button[data-target]') : [];
    const sections = document.querySelectorAll('main section');
    // store initial Add button innerHTML/icon/text so we can restore it reliably
    let initialAddInnerHTML = null;
    let initialAddIconSrc = null;
    let initialAddText = '';

    function updateHeaderSearchVisibility(activeSectionId) {
        // debug logs removed for production
        // Hide the header search/dropdowns on 'beranda' (overview).
        // Keep filters visible for other sections including 'lainnya' (Jasa)
        const hideEntireHeader = activeSectionId === 'beranda';

        // Deterministic header visibility: ensure header element is hidden on beranda
        // header visibility already handled earlier in this function

        if (headerSearch) {
            headerSearch.setAttribute('aria-hidden', hideEntireHeader ? 'true' : 'false');
            headerSearch.style.display = hideEntireHeader ? 'none' : 'flex';
        }

        if (headerDropdowns) {
            headerDropdowns.setAttribute('aria-hidden', hideEntireHeader ? 'true' : 'false');
            headerDropdowns.style.display = hideEntireHeader ? 'none' : 'flex';
            // ensure select-row is visible by default for pages that use filters (Items/Jasa)
            const selectRow = headerDropdowns.querySelector('.select-row');
            if (selectRow) selectRow.style.display = '';
        }

        // Special-case behaviour for the Jasa page ('lainnya'):
        // - hide Kategori and Kondisi filters
        // - change the middle filter (panel-stok) to act as "Layanan"
        try {
            const kategoriWrap = document.querySelector('#resetKategori') && document.querySelector('#resetKategori').closest('.filter-wrap');
            const jenisWrap = document.querySelector('#resetJenis') && document.querySelector('#resetJenis').closest('.filter-wrap');
            const stokBtn = document.querySelector('#resetStok');
            const stokWrap = stokBtn && stokBtn.closest('.filter-wrap');

            // Never show the header back button or master header when viewing Item or Jasa
            try {
                if (activeSectionId === 'lainnya' || activeSectionId === 'item') {
                    const selectRowInner = document.querySelector('#header-dropdowns .select-row');
                    const maybeBack = selectRowInner && selectRowInner.querySelector('.back-btn');
                    if (maybeBack && maybeBack.parentNode) maybeBack.parentNode.removeChild(maybeBack);
                    const maybeMH = selectRowInner && selectRowInner.querySelector('.master-header');
                    if (maybeMH && maybeMH.parentNode) maybeMH.parentNode.removeChild(maybeMH);
                }
            } catch (e) { /* ignore */ }

            if (activeSectionId === 'lainnya') {
                if (kategoriWrap) kategoriWrap.style.display = 'none';
                if (jenisWrap) jenisWrap.style.display = 'none';
                if (stokBtn) {
                    stokBtn.textContent = 'Layanan';
                    stokBtn.dataset.mode = 'layanan';
                }
                if (stokWrap) stokWrap.style.display = '';
                // Hide Status filter on Jasa (lainnya)
                const statusWrap = document.querySelector('#resetStatus') && document.querySelector('#resetStatus').closest('.filter-wrap');
                if (statusWrap) statusWrap.style.display = 'none';
                // Ensure the 'Lihat Master' header control is not present on Jasa page
                try {
                    const selectRowInner = document.querySelector('#header-dropdowns .select-row');
                    const maybeVM = selectRowInner && selectRowInner.querySelector('.view-master-btn');
                    if (maybeVM && maybeVM.parentNode) maybeVM.parentNode.removeChild(maybeVM);
                } catch (e) { /* ignore */ }
            } else if (activeSectionId === 'unit') {
                // For Unit page: hide Kategori and Kondisi, and hide the Stok control
                // in the header (per request). Change the header add button label to "Lihat Master".
                // ensure master header is removed when showing Unit so the "Master Unit"
                // title/logo doesn't persist after returning from Master view
                try { const mhTop = document.querySelector('#header-dropdowns .select-row .master-header'); if (mhTop && mhTop.parentNode) mhTop.parentNode.removeChild(mhTop); } catch (e) { }
                if (kategoriWrap) kategoriWrap.style.display = 'none';
                if (jenisWrap) jenisWrap.style.display = 'none';
                // hide stok filter entirely for Unit page
                if (stokWrap) stokWrap.style.display = 'none';
                // Update header Add button to read "Lihat Master" when on Unit page
                try {
                    // Ensure .add-btn is hidden on Unit page (it's for Item only)
                    const addBtn = document.querySelector('.add-btn');
                    if (addBtn) {
                        try {
                            if (addBtn.__navBackHandler) { try { addBtn.removeEventListener('click', addBtn.__navBackHandler); } catch (e) { } delete addBtn.__navBackHandler; }
                            // keep items handler attached but hide visually
                            try { addBtn.style.display = 'none'; } catch (e) { }
                        } catch (e) { /* ignore */ }
                    }

                    // Create or show a dedicated 'Lihat Master' button in header (.view-master-btn)
                    const selectRow = document.querySelector('#header-dropdowns .select-row');
                    if (selectRow) {
                        let vm = selectRow.querySelector('.view-master-btn');
                        if (!vm) {
                            vm = document.createElement('button');
                            vm.className = 'view-master-btn';
                            vm.setAttribute('aria-label', 'Lihat Master');
                            vm.textContent = 'Lihat Master';
                            // insert left of filters
                            selectRow.insertBefore(vm, selectRow.firstChild);
                        } else {
                            vm.style.display = '';
                            // ensure any header back button is hidden when showing Lihat Master
                            try { const hback = selectRow.querySelector('.back-btn'); if (hback) hback.style.display = 'none'; } catch (e) { }
                        }
                        // attach handler (ensure idempotent)
                        try { if (vm.__handler) vm.removeEventListener('click', vm.__handler); } catch (e) { }
                        const handler = async (ev) => {
                            ev && ev.preventDefault && ev.preventDefault();
                            try {
                                // activate master section
                                document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
                                const masterBtn = document.querySelector('.bottom-nav button[data-target="master"]');
                                if (masterBtn) masterBtn.classList.add('active');
                                document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
                                const masterSection = document.getElementById('master');
                                if (masterSection) masterSection.classList.add('active');
                                if (window.appMasterUI && typeof window.appMasterUI.renderMasterPage === 'function') await window.appMasterUI.renderMasterPage();
                                try { if (window.appNavigation && typeof window.appNavigation.updateHeaderSearchVisibility === 'function') window.appNavigation.updateHeaderSearchVisibility('master'); } catch (e) { }
                            } catch (e) { /* ignore */ }
                        };
                        vm.addEventListener('click', async (ev) => {
                            // first run original handler logic
                            await handler(ev);
                            try {
                                // hide the Lihat Master button while inside Master
                                vm.style.display = 'none';
                            } catch (e) { }

                            // create or show a dedicated header back button (.back-btn) that returns to Unit
                            try {
                                const selectRowInner = document.querySelector('#header-dropdowns .select-row');
                                if (selectRowInner) {
                                    let hback = selectRowInner.querySelector('.back-btn');
                                    let createdBack = false;
                                    if (!hback) {
                                        hback = document.createElement('button');
                                        hback.className = 'back-btn';
                                        hback.setAttribute('aria-label', 'Kembali');
                                        hback.innerHTML = '<img src="assets/icons/back.svg" alt="Kembali" />';
                                        selectRowInner.insertBefore(hback, selectRowInner.firstChild);
                                        createdBack = true;
                                    } else {
                                        hback.style.display = '';
                                    }

                                    // remove any previous nav-to-unit handler we set
                                    try { if (hback.__navBackToUnitHandler) { hback.removeEventListener('click', hback.__navBackToUnitHandler); delete hback.__navBackToUnitHandler; } } catch (e) { }

                                    const navToUnit = function (ev2) {
                                        ev2 && ev2.preventDefault && ev2.preventDefault();
                                        try {
                                            const unitBtn = document.querySelector('.bottom-nav button[data-target="unit"]');
                                            if (unitBtn) unitBtn.click();
                                            else {
                                                // fallback manual switch
                                                document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
                                                const unitBtn2 = document.querySelector('.bottom-nav button[data-target="unit"]');
                                                if (unitBtn2) unitBtn2.classList.add('active');
                                                document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
                                                const unitSection = document.getElementById('unit');
                                                if (unitSection) unitSection.classList.add('active');
                                                try { updateHeaderSearchVisibility('unit'); } catch (e) { }
                                            }
                                        } catch (e) { /* ignore */ }

                                        // after navigation, hide back button and restore Lihat Master
                                        try {
                                            if (hback && hback.__navBackToUnitHandler) { hback.removeEventListener('click', hback.__navBackToUnitHandler); delete hback.__navBackToUnitHandler; }
                                        } catch (e) { }
                                        try { if (!createdBack && hback) hback.style.display = 'none'; else if (hback && hback.parentNode && createdBack) hback.parentNode.removeChild(hback); } catch (e) { }
                                        try { if (vm) vm.style.display = ''; } catch (e) { }
                                    };

                                    hback.addEventListener('click', navToUnit);
                                    hback.__navBackToUnitHandler = navToUnit;
                                }
                            } catch (e) { }
                        });
                        vm.__handler = handler;
                        // extra: ensure any header back button is hidden when unit view is active
                        try { const maybeBack = document.querySelector('#header-dropdowns .select-row .back-btn'); if (maybeBack) maybeBack.style.display = 'none'; } catch (e) { }
                        // ensure master header (title/logo) is hidden on Unit view
                        try { const mh = document.querySelector('#header-dropdowns .select-row .master-header'); if (mh) mh.style.display = 'none'; } catch (e) { }
                    }
                } catch (e) { /* ignore DOM quirks */ }
                // Ensure Status filter is visible for Unit page (status is useful for units)
                const statusWrapUnit = document.querySelector('#resetStatus') && document.querySelector('#resetStatus').closest('.filter-wrap');
                if (statusWrapUnit) statusWrapUnit.style.display = '';
                // notify listeners
                try { document.dispatchEvent(new CustomEvent('filter-mode-changed')); } catch (e) { }
            } else if (activeSectionId === 'master') {
                // For Master page: hide stok filter and status filter in header.
                if (stokWrap) stokWrap.style.display = 'none';
                const statusWrap = document.querySelector('#resetStatus') && document.querySelector('#resetStatus').closest('.filter-wrap');
                if (statusWrap) statusWrap.style.display = 'none';
                // Replace the Add button with a Back-to-Unit button
                try {
                    const addBtn = document.querySelector('.add-btn');
                    if (addBtn) {
                        // hide add button entirely in Master view to avoid conflicting actions
                        try {
                            if (addBtn.__navBackHandler) { try { addBtn.removeEventListener('click', addBtn.__navBackHandler); } catch (e) { } delete addBtn.__navBackHandler; }
                            if (addBtn.__itemsHandler) { try { addBtn.removeEventListener('click', addBtn.__itemsHandler); } catch (e) { } }
                        } catch (e) { /* ignore */ }
                        try { addBtn.style.display = 'none'; } catch (e) { }
                    }
                } catch (e) { /* ignore */ }
                // ensure master header (title/logo) is visible on Master view
                try { const mh = document.querySelector('#header-dropdowns .select-row .master-header'); if (mh) mh.style.display = ''; } catch (e) { }
            } else {
                // restore defaults for non-jasa pages
                // Ensure the 'Lihat Master' header control is not present on Item (and other non-unit pages)
                try {
                    const selectRowInner = document.querySelector('#header-dropdowns .select-row');
                    const maybeVM = selectRowInner && selectRowInner.querySelector('.view-master-btn');
                    if (maybeVM && maybeVM.parentNode) maybeVM.parentNode.removeChild(maybeVM);
                } catch (e) { /* ignore */ }
                if (kategoriWrap) kategoriWrap.style.display = '';
                if (jenisWrap) jenisWrap.style.display = '';
                if (stokBtn) {
                    stokBtn.textContent = 'Stok';
                    delete stokBtn.dataset.mode;
                }
                // ensure any unit-specific modes are cleared so Item page builds its own category list
                try {
                    const kbtn = kategoriWrap && kategoriWrap.querySelector('.filter-btn');
                    const jbtn = jenisWrap && jenisWrap.querySelector('.filter-btn');
                    if (kbtn && kbtn.dataset && kbtn.dataset.mode) delete kbtn.dataset.mode;
                    if (jbtn && jbtn.dataset && jbtn.dataset.mode) delete jbtn.dataset.mode;
                } catch (e) { /* ignore */ }
                if (stokWrap) stokWrap.style.display = '';
                // Hide Status filter on other pages by default
                const statusWrapOther = document.querySelector('#resetStatus') && document.querySelector('#resetStatus').closest('.filter-wrap');
                if (statusWrapOther) statusWrapOther.style.display = 'none';
                // ensure add button is visible again for other pages (Item uses it)
                try { const addBtn = document.querySelector('.add-btn'); if (addBtn) addBtn.style.display = ''; } catch (e) { }
            }
            // Notify listeners (e.g. itemsUI) that filter mode changed so panels can rebuild
            try { document.dispatchEvent(new CustomEvent('filter-mode-changed')); } catch (e) { /* ignore */ }
        } catch (e) { /* ignore DOM quirks */ }

        // Ensure Add button state is authoritative and idempotent: set its
        // innerHTML and handlers based on the activeSectionId. This prevents
        // ad-hoc code in other modules from leaving the Add button in an
        // inconsistent state.
        try {
            const addBtn = document.querySelector('.add-btn');
            if (addBtn) {
                // remove previous nav-back handler if present
                try { if (addBtn.__navBackHandler) { addBtn.removeEventListener('click', addBtn.__navBackHandler); delete addBtn.__navBackHandler; } } catch (e) { }

                // If we're in Master mode, show a clear Back button that returns to Unit.
                if (activeSectionId === 'master') {
                    const backIcon = 'assets/icons/undo.svg';
                    // show an icon-only Back button (use back.svg) and keep aria-label
                    addBtn.innerHTML = '<img src="assets/icons/back.svg" alt="Kembali" />';
                    addBtn.setAttribute('aria-label', 'Kembali ke Unit');
                    const handler = function (ev) {
                        ev.preventDefault();
                        try {
                            const unitBtn = document.querySelector('.bottom-nav button[data-target="unit"]');
                            if (unitBtn) unitBtn.click();
                            else {
                                // fallback: manually switch to unit and update header
                                document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
                                const unitBtn2 = document.querySelector('.bottom-nav button[data-target="unit"]');
                                if (unitBtn2) unitBtn2.classList.add('active');
                                document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
                                const unitSection = document.getElementById('unit');
                                if (unitSection) unitSection.classList.add('active');
                                try { updateHeaderSearchVisibility('unit'); } catch (e) { }
                            }
                        } catch (e) { /* ignore */ }
                    };
                    addBtn.addEventListener('click', handler);
                    addBtn.__navBackHandler = handler;
                } else if (activeSectionId === 'unit') {
                    // For Unit page we want the add button to be a plain text "Lihat Master"
                    try {
                        addBtn.innerHTML = 'Lihat Master';
                        addBtn.setAttribute('aria-label', 'Lihat Master');
                    } catch (e) { /* ignore */ }
                    // Reattach items handler if available so clicking Lihat Master still runs itemsUI handler
                    try {
                        if (addBtn.__itemsHandler && typeof addBtn.__itemsHandler === 'function') {
                            try { addBtn.removeEventListener('click', addBtn.__itemsHandler); } catch (e) { }
                            addBtn.addEventListener('click', addBtn.__itemsHandler);
                        }
                    } catch (e) { /* ignore */ }
                } else {
                    // For other pages, restore original Add appearance and reattach items handler if available
                    try {
                        if (initialAddInnerHTML) addBtn.innerHTML = initialAddInnerHTML;
                        else if (initialAddIconSrc) addBtn.innerHTML = `<img src="${initialAddIconSrc}" alt="Lihat Master"/> ${initialAddText || 'Lihat Master'}`;
                        else addBtn.textContent = initialAddText || 'Tambah';
                        addBtn.setAttribute('aria-label', initialAddText || 'Tambah');
                    } catch (e) { /* ignore */ }
                    try {
                        if (addBtn.__itemsHandler && typeof addBtn.__itemsHandler === 'function') {
                            try { addBtn.removeEventListener('click', addBtn.__itemsHandler); } catch (e) { }
                            addBtn.addEventListener('click', addBtn.__itemsHandler);
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        } catch (e) { /* ignore */ }

        // Toggle html.show-header so CSS controls whether header is visible.
        try {
            const root = document.documentElement;
            if (hideEntireHeader) {
                // remove immediately when we must hide the header
                try { root.classList.remove('show-header'); } catch (e) { }
            } else {
                // Only add 'show-header' after app has signalled it's ready to avoid
                // flashes on full reloads. If app-ready isn't present yet, poll briefly
                // and add the class once app-ready appears (or after a short timeout).
                // Only add show-header for non-beranda pages. This prevents
                // a flash of header on full reloads when the initial active
                // view is Beranda but timing causes the class to be added.
                const addShowHeader = () => { try { if (activeSectionId !== 'beranda') root.classList.add('show-header'); } catch (e) { /* ignore */ } };

                if (root.classList.contains('app-ready')) {
                    // Only add header if the bottom-nav's currently active button
                    // corresponds to the activeSectionId. This avoids a race where
                    // another module temporarily requests header for a different
                    // section while the user is still on Beranda.
                    try {
                        const activeNavBtn = document.querySelector('.bottom-nav button.active');
                        const activeNavTarget = activeNavBtn ? activeNavBtn.dataset.target : null;
                        if (activeNavTarget === activeSectionId) {
                            addShowHeader();
                        } else {
                            // active nav doesn't match requested section; skip adding header
                        }
                    } catch (e) {
                        // fallback to adding when we can't verify nav state
                        addShowHeader();
                    }
                } else {
                    // Poll up to 1000ms for app-ready; then add as a fallback to avoid
                    // permanently hiding header in edge cases.
                    let waited = 0;
                    const interval = 50;
                    const maxWait = 1000;
                    const timer = setInterval(() => {
                        waited += interval;
                        if (root.classList.contains('app-ready')) {
                            addShowHeader();
                            // debug log removed
                            clearInterval(timer);
                        } else if (waited >= maxWait) {
                            // fallback: add only when not on beranda to avoid
                            // permanently showing header on the home page due to timing.
                            addShowHeader();
                            // debug log removed
                            clearInterval(timer);
                        }
                    }, interval);
                }
            }
        } catch (e) { /* ignore */ }
    }

    function initNavigation() {
        // attach click handlers similar to original script.js
        navButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                navButtons.forEach((b) => b.classList.remove('active'));
                sections.forEach((s) => s.classList.remove('active'));

                btn.classList.add('active');
                const target = document.getElementById(btn.dataset.target);
                if (target) target.classList.add('active');

                updateHeaderSearchVisibility(btn.dataset.target);
            });
        });

        // capture original Add button HTML so we can restore it later
        try {
            const ab = document.querySelector('.add-btn');
            if (ab) {
                initialAddInnerHTML = ab.innerHTML;
                const img = ab.querySelector('img');
                initialAddIconSrc = img ? img.getAttribute('src') : null;
                initialAddText = (ab.textContent || '').trim();
            }
        } catch (e) { /* ignore */ }

        // initial visibility based on currently active nav
        const activeNav = document.querySelector('.bottom-nav button.active');
        const activeTarget = activeNav ? activeNav.dataset.target : 'beranda';
        updateHeaderSearchVisibility(activeTarget);

        // signal that navigation init finished — UI can now reveal elements that were hidden to avoid flash
        try { document.documentElement.classList.add('app-ready'); } catch (e) { /* ignore */ }

        // responsive minor behavior: keep compact class toggles
        function responsiveToggle() {
            const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            if (!headerSearch) return;
            if (vw < 640) headerSearch.classList.add('compact'); else headerSearch.classList.remove('compact');
        }
        responsiveToggle();
        window.addEventListener('resize', responsiveToggle);
    }

    // expose
    window.appNavigation = { initNavigation, updateHeaderSearchVisibility };
})();
