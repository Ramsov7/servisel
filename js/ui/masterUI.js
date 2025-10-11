/* masterUI.js — Master units browser: brands -> models */

(function () {
    const containerId = 'master';
    const container = document.getElementById(containerId);

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function titleCase(s) {
        if (!s) return '';
        return String(s).toLowerCase().split(/\s+/).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
    }

    // Normalize brand aliases to a canonical display name. This ensures
    // 'iphone' and 'apple' are treated as the same brand (Apple), etc.
    function canonicalBrand(brand) {
        if (!brand) return 'Unknown';
        const map = {
            'iphone': 'Apple', 'apple': 'Apple',
            'samsung': 'Samsung',
            'xiaomi': 'Xiaomi', 'redmi': 'Xiaomi',
            'realme': 'Realme', 'oppo': 'Oppo', 'vivo': 'Vivo',
            'huawei': 'Huawei', 'itel': 'Itel', 'infinix': 'Infinix', 'tecno': 'Tecno'
        };
        const key = String(brand).trim().toLowerCase();
        return map[key] || titleCase(key);
    }

    // helper: map brand name to logo asset path
    function brandToLogoSrc(brand) {
        if (!brand) return null;
        const map = {
            'iphone': 'apple', 'apple': 'apple',
            'samsung': 'samsung',
            'xiaomi': 'xiaomi', 'redmi': 'xiaomi',
            'realme': 'realme', 'oppo': 'oppo', 'vivo': 'vivo',
            'huawei': 'huawei', 'itel': 'itel', 'infinix': 'infinix', 'tecno': 'tecno'
        };
        const key = (brand || '').toString().trim().toLowerCase();
        const resolved = map[key] || key.replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
        return resolved ? `assets/logos/brand/logo-${resolved}.svg` : null;
    }

    async function fetchMasterUnits() {
        try {
            const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
            if (!sup) return [];
            // avoid probing if table doesn't exist
            try {
                if (typeof window.tableExists === 'function') {
                    const ok = await window.tableExists('master_unit', sup);
                    if (!ok) return [];
                }
            } catch (e) { /* ignore and continue to attempt select */ }
            const res = await sup.from('master_unit').select('*').limit(2000);
            if (res.error) return [];
            return res.data || [];
        } catch (e) { return []; }
    }

    async function renderMasterPage() {
        if (!container) return;
        try {
            const card = container.querySelector('.card');
            if (!card) return;
            const existing = card.querySelector('.card-body');
            if (existing) existing.remove();

            const cb = document.createElement('div');
            cb.className = 'card-body';

            const master = await fetchMasterUnits();

            // Build a normalized brands map to avoid duplicate keys caused by
            // differing casing or whitespace in master_unit rows. Keyed by
            // lowercase brand name; value contains display name and rows list.
            const brandsMap = {};
            (master || []).forEach(m => {
                const raw = (m.nama_brand || 'Unknown').toString().trim();
                const canon = canonicalBrand(raw);
                const key = canon.toLowerCase();
                if (!brandsMap[key]) brandsMap[key] = { key: key, display: canon, rows: [] };
                brandsMap[key].rows.push(m);
            });

            // Ensure developer-managed brand list (from assets/logos/brand) always appears
            // even if there are 0 types for that brand. This list mirrors the files
            // present under assets/logos/brand as maintained by developers.
            const developerBrands = ['Apple', 'Huawei', 'Infinix', 'Itel', 'Oppo', 'Realme', 'Samsung', 'Tecno', 'Vivo', 'Xiaomi'];
            developerBrands.forEach(db => {
                const canon = canonicalBrand(db);
                const key = String(canon).toLowerCase();
                if (!brandsMap[key]) brandsMap[key] = { key: key, display: canon, rows: [] };
                else brandsMap[key].display = brandsMap[key].display || canon;
            });

            const brandWrap = document.createElement('div');
            // make brands grid behave like items grid so cards match
            brandWrap.className = 'brand-cards master-brands items-grid';

            function insertBrandLogo(imgWrap, brandName) {
                try {
                    if (!imgWrap) return;
                    // mark this img-wrap as a brand logo container so CSS can make it square
                    try { imgWrap.classList.add && imgWrap.classList.add('brand-logo'); } catch (e) { }
                    imgWrap.innerHTML = '';
                    const src = brandToLogoSrc(brandName);
                    if (!src) return;
                    const img = document.createElement('img');
                    img.className = 'card-thumb brand-thumb';
                    img.alt = brandName || 'brand';
                    img.loading = 'lazy';
                    img.src = src;
                    img.addEventListener('error', function () {
                        // fallback to generic servisel logo if present
                        this.onerror = null;
                        this.src = 'assets/logos/servisel.png';
                    });
                    imgWrap.appendChild(img);
                } catch (e) { /* ignore logo errors */ }
            }

            Object.values(brandsMap).sort((a, b) => a.display.localeCompare(b.display, 'id')).forEach(entry => {
                const cardB = document.createElement('div');
                cardB.className = 'item-card compact modern brand-card master-brand';
                // expose normalized brand key on the element
                cardB.dataset.brand = entry.key;
                const count = (entry.rows && entry.rows.length) ? entry.rows.length : 0;
                cardB.innerHTML = `
                    <div class="card-main">
                        <div class="img-wrap"></div>
                        <div class="card-meta">
                            <div class="card-title">${escapeHtml(entry.display)}</div>
                            <div class="card-stock">${count} tipe</div>
                        </div>
                    </div>
                `;
                brandWrap.appendChild(cardB);
                // populate brand logo into img-wrap
                try {
                    const imgWrap = cardB.querySelector('.img-wrap');
                    insertBrandLogo(imgWrap, entry.display);
                } catch (e) { /* ignore */ }
                // when clicked, show model cards below and pass the clicked element so we can
                // hide other brand cards for focused view
                cardB.addEventListener('click', async () => {
                    showModelsForBrand(entry.display, entry.rows, cardB);
                });
            });

            cb.appendChild(brandWrap);

            // ensure header shows "Master Unit" title next to back/view buttons
            try {
                const selectRow = document.querySelector('#header-dropdowns .select-row');
                if (selectRow) {
                    let mh = selectRow.querySelector('.master-header');
                    if (!mh) {
                        mh = document.createElement('div');
                        mh.className = 'master-header';
                        mh.style.display = 'inline-flex';
                        mh.style.alignItems = 'center';
                        mh.style.gap = '8px';
                        const title = document.createElement('h3');
                        title.className = 'master-header-title';
                        title.textContent = 'Master Unit';
                        title.style.margin = '0';
                        title.style.fontSize = '16px';
                        mh.appendChild(title);
                        // placeholder for brand logo when viewing models
                        const logoWrap = document.createElement('div');
                        logoWrap.className = 'master-header-logo';
                        logoWrap.style.display = 'none';
                        mh.appendChild(logoWrap);
                        // insert after any left-most control (like back/view button)
                        selectRow.insertBefore(mh, selectRow.firstChild.nextSibling || null);
                    } else {
                        const title = mh.querySelector('.master-header-title');
                        if (title) title.textContent = 'Master Unit';
                    }
                }
            } catch (e) { /* ignore header quirks */ }

            // placeholder for models
            const modelsWrap = document.createElement('div');
            modelsWrap.className = 'brand-models';
            cb.appendChild(modelsWrap);

            // remove any static title inside the card to avoid duplicate headings in content
            try {
                const staticTitle = card.querySelector('h3');
                if (staticTitle) staticTitle.parentNode && staticTitle.parentNode.removeChild(staticTitle);
            } catch (e) { }

            card.appendChild(cb);
        } catch (e) { console.error('renderMasterPage error', e); }
    }

    function showModelsForBrand(brandName, rows, clickedCardEl) {
        const card = container.querySelector('.card');
        if (!card) return;
        const modelsWrap = card.querySelector('.brand-models');
        const brandWrap = card.querySelector('.brand-cards');
        if (!modelsWrap) return;

        // clear card body and ensure only modelsWrap exists there so content shows only type cards
        try {
            const cardBody = card.querySelector('.card-body');
            if (cardBody) {
                cardBody.innerHTML = '';
                // ensure modelsWrap is a fresh container inside cardBody
                cardBody.appendChild(modelsWrap);
            }
        } catch (e) { /* ignore */ }

        // clear models area
        modelsWrap.innerHTML = '';

        // modelsWrap will contain only the type cards (no in-content headers)

        // show selected brand logo in header (if available)
        try {
            const selectRow = document.querySelector('#header-dropdowns .select-row');
            if (selectRow) {
                const mh = selectRow.querySelector('.master-header');
                if (mh) {
                    const lw = mh.querySelector('.master-header-logo');
                    if (lw) {
                        // populate logo
                        lw.innerHTML = '';
                        const src = brandToLogoSrc(brandName);
                        if (src) {
                            const img = document.createElement('img');
                            img.src = src;
                            img.alt = brandName || 'brand';
                            img.className = 'master-header-brand-logo';
                            lw.appendChild(img);
                            lw.style.display = '';
                        } else {
                            lw.style.display = 'none';
                        }
                    }
                }
            }
        } catch (e) { /* ignore */ }

        // Use (or create) a dedicated header back button `.back-btn` so we don't reuse .add-btn
        try {
            let backBtn = document.querySelector('.back-btn');
            let created = false;
            if (!backBtn) {
                // try to insert into header select-row if present
                const selectRow = document.querySelector('#header-dropdowns .select-row');
                if (selectRow) {
                    backBtn = document.createElement('button');
                    backBtn.className = 'back-btn';
                    backBtn.setAttribute('aria-label', 'Kembali');
                    // use icon instead of text
                    backBtn.innerHTML = '<img src="assets/icons/back.svg" alt="Kembali" />';
                    // insert as the first child so it appears left of filters
                    selectRow.insertBefore(backBtn, selectRow.firstChild);
                    created = true;
                }
            }

            if (backBtn) {
                // remove any previous temporary handler we set earlier
                try { if (backBtn.__masterModelsBackHandler) { backBtn.removeEventListener('click', backBtn.__masterModelsBackHandler); delete backBtn.__masterModelsBackHandler; } } catch (e) { }

                // If there's an existing header handler that navigates to Unit, save and remove it so
                // our models-back handler can take precedence while types are shown.
                try {
                    if (backBtn.__navBackToUnitHandler) {
                        backBtn.__savedNavBackToUnitHandler = backBtn.__navBackToUnitHandler;
                        try { backBtn.removeEventListener('click', backBtn.__navBackToUnitHandler); } catch (e) { }
                        try { delete backBtn.__navBackToUnitHandler; } catch (e) { }
                    }
                    if (backBtn.__navBackHandler) {
                        backBtn.__savedNavBackHandler = backBtn.__navBackHandler;
                        try { backBtn.removeEventListener('click', backBtn.__navBackHandler); } catch (e) { }
                        try { delete backBtn.__navBackHandler; } catch (e) { }
                    }
                } catch (e) { }

                // save original display so we can restore if we created or hid it
                try { backBtn.__savedDisplay = backBtn.__savedDisplay || backBtn.style.display || ''; } catch (e) { }

                const restoreBrands = function (ev) {
                    ev && ev.preventDefault && ev.preventDefault();
                    try {
                        // rebuild the master page (re-render brand list)
                        try { if (window.appMasterUI && typeof window.appMasterUI.renderMasterPage === 'function') window.appMasterUI.renderMasterPage(); } catch (e) { }
                    } catch (e) { }
                    try { modelsWrap.innerHTML = ''; } catch (e) { }
                    try { if (brandWrap) brandWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }

                    // remove this temporary handler
                    try { if (backBtn.__masterModelsBackHandler) { backBtn.removeEventListener('click', backBtn.__masterModelsBackHandler); delete backBtn.__masterModelsBackHandler; } } catch (e) { }

                    // restore any previously saved header handler that navigates to Unit
                    try {
                        if (backBtn.__savedNavBackToUnitHandler) {
                            backBtn.addEventListener('click', backBtn.__savedNavBackToUnitHandler);
                            backBtn.__navBackToUnitHandler = backBtn.__savedNavBackToUnitHandler;
                            delete backBtn.__savedNavBackToUnitHandler;
                        }
                        if (backBtn.__savedNavBackHandler) {
                            backBtn.addEventListener('click', backBtn.__savedNavBackHandler);
                            backBtn.__navBackHandler = backBtn.__savedNavBackHandler;
                            delete backBtn.__savedNavBackHandler;
                        }
                    } catch (e) { }

                    // if we created this button, remove it from DOM; otherwise restore display
                    try {
                        if (created && backBtn && backBtn.parentNode) backBtn.parentNode.removeChild(backBtn);
                        else if (backBtn) backBtn.style.display = backBtn.__savedDisplay || '';
                    } catch (e) { }
                    // hide header brand logo if present
                    try {
                        const mh = document.querySelector('#header-dropdowns .select-row .master-header');
                        if (mh) {
                            const lw = mh.querySelector('.master-header-logo');
                            if (lw) lw.style.display = 'none';
                        }
                    } catch (e) { }
                };

                backBtn.addEventListener('click', restoreBrands);
                backBtn.__masterModelsBackHandler = restoreBrands;
                // ensure visible
                try { backBtn.style.display = ''; } catch (e) { }
            }
        } catch (e) { /* ignore header wiring errors */ }

        const grid = document.createElement('div');
        grid.className = 'models-grid items-grid';
        (rows || []).forEach(r => {
            const mcard = document.createElement('div');
            mcard.className = 'item-card compact modern model-card';
            mcard.innerHTML = `
                <div class="card-main">
                    <div class="img-wrap"></div>
                    <div class="card-meta">
                        <div class="card-title">${escapeHtml(r.nama_model || r.kode_model || '')}</div>
                        <div class="card-stock">${escapeHtml(r.variant || '')}</div>
                    </div>
                </div>
            `;
            // insert placeholder image (same behavior as item/unit cards)
            try {
                const imgWrap = mcard.querySelector('.img-wrap');
                const spinner = document.createElement('div');
                spinner.className = 'img-spinner';
                imgWrap.appendChild(spinner);
                if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                const ph = document.createElement('div');
                ph.className = 'card-thumb placeholder';
                ph.textContent = 'Tidak Ada Gambar';
                imgWrap.appendChild(ph);
            } catch (e) { /* ignore */ }
            grid.appendChild(mcard);
        });
        modelsWrap.appendChild(grid);
        // ensure models area visible and focus
        try { modelsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
    }
    async function init() {
        // nothing heavy now; leave render to caller
    }

    window.appMasterUI = { init, renderMasterPage, showModelsForBrand };
})();
