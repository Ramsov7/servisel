/* master-ui.js — kebab-case copy of masterUI.js (logic unchanged) */

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
            try {
                if (typeof window.tableExists === 'function') {
                    const ok = await window.tableExists('master_unit', sup);
                    if (!ok) return [];
                }
            } catch (e) { }
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

            const brandsMap = {};
            (master || []).forEach(m => {
                const raw = (m.nama_brand || 'Unknown').toString().trim();
                const canon = canonicalBrand(raw);
                const key = canon.toLowerCase();
                if (!brandsMap[key]) brandsMap[key] = { key: key, display: canon, rows: [] };
                brandsMap[key].rows.push(m);
            });

            const developerBrands = ['Apple', 'Huawei', 'Infinix', 'Itel', 'Oppo', 'Realme', 'Samsung', 'Tecno', 'Vivo', 'Xiaomi', 'Motorola', 'Asus'];
            developerBrands.forEach(db => {
                const canon = canonicalBrand(db);
                const key = String(canon).toLowerCase();
                if (!brandsMap[key]) brandsMap[key] = { key: key, display: canon, rows: [] };
                else brandsMap[key].display = brandsMap[key].display || canon;
            });

            const brandWrap = document.createElement('div');
            brandWrap.className = 'brand-cards master-brands items-grid';

            function insertBrandLogo(imgWrap, brandName) {
                try {
                    if (!imgWrap) return;
                    try { imgWrap.classList.add && imgWrap.classList.add('brand-logo'); } catch (e) { }
                    imgWrap.innerHTML = '';
                    const src = brandToLogoSrc(brandName);
                    if (!src) return;
                    const img = document.createElement('img');
                    img.className = 'card-thumb brand-thumb';
                    img.alt = brandName || 'brand';
                    img.loading = 'lazy';
                    img.src = src;
                    img.addEventListener('error', function () { this.onerror = null; this.src = 'assets/logos/servisel.png'; });
                    imgWrap.appendChild(img);
                } catch (e) { }
            }

            Object.values(brandsMap).sort((a, b) => a.display.localeCompare(b.display, 'id')).forEach(entry => {
                const cardB = document.createElement('div');
                cardB.className = 'item-card compact modern brand-card master-brand';
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
                try { const imgWrap = cardB.querySelector('.img-wrap'); insertBrandLogo(imgWrap, entry.display); } catch (e) { }
                cardB.addEventListener('click', async () => { showModelsForBrand(entry.display, entry.rows, cardB); });
            });

            cb.appendChild(brandWrap);

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
                        const logoWrap = document.createElement('div');
                        logoWrap.className = 'master-header-logo';
                        logoWrap.style.display = 'none';
                        mh.appendChild(logoWrap);
                        selectRow.insertBefore(mh, selectRow.firstChild.nextSibling || null);
                    } else {
                        const title = mh.querySelector('.master-header-title');
                        if (title) title.textContent = 'Master Unit';
                    }
                }
            } catch (e) { }

            const modelsWrap = document.createElement('div');
            modelsWrap.className = 'brand-models';
            cb.appendChild(modelsWrap);

            try { const staticTitle = card.querySelector('h3'); if (staticTitle) staticTitle.parentNode && staticTitle.parentNode.removeChild(staticTitle); } catch (e) { }

            card.appendChild(cb);
        } catch (e) { console.error('renderMasterPage error', e); }
    }

    function showModelsForBrand(brandName, rows, clickedCardEl) {
        const card = container.querySelector('.card');
        if (!card) return;
        const modelsWrap = card.querySelector('.brand-models');
        const brandWrap = card.querySelector('.brand-cards');
        if (!modelsWrap) return;

        try {
            const cardBody = card.querySelector('.card-body');
            if (cardBody) {
                cardBody.innerHTML = '';
                cardBody.appendChild(modelsWrap);
            }
        } catch (e) { }

        modelsWrap.innerHTML = '';

        try {
            const selectRow = document.querySelector('#header-dropdowns .select-row');
            if (selectRow) {
                const mh = selectRow.querySelector('.master-header');
                if (mh) {
                    const lw = mh.querySelector('.master-header-logo');
                    if (lw) {
                        lw.innerHTML = '';
                        const src = brandToLogoSrc(brandName);
                        if (src) {
                            const img = document.createElement('img');
                            img.src = src;
                            img.alt = brandName || 'brand';
                            img.className = 'master-header-brand-logo';
                            lw.appendChild(img);
                            lw.style.display = '';
                        } else { lw.style.display = 'none'; }
                    }
                }
            }
        } catch (e) { }

        try {
            let backBtn = document.querySelector('.back-btn');
            let created = false;
            if (!backBtn) {
                const selectRow = document.querySelector('#header-dropdowns .select-row');
                if (selectRow) {
                    backBtn = document.createElement('button');
                    backBtn.className = 'back-btn';
                    backBtn.setAttribute('aria-label', 'Kembali');
                    backBtn.innerHTML = '<img src="assets/icons/back.svg" alt="Kembali" />';
                    selectRow.insertBefore(backBtn, selectRow.firstChild);
                    created = true;
                }
            }

            if (backBtn) {
                try { if (backBtn.__masterModelsBackHandler) { backBtn.removeEventListener('click', backBtn.__masterModelsBackHandler); delete backBtn.__masterModelsBackHandler; } } catch (e) { }

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

                try { backBtn.__savedDisplay = backBtn.__savedDisplay || backBtn.style.display || ''; } catch (e) { }

                const restoreBrands = function (ev) {
                    ev && ev.preventDefault && ev.preventDefault();
                    try { if (window.appMasterUI && typeof window.appMasterUI.renderMasterPage === 'function') window.appMasterUI.renderMasterPage(); } catch (e) { }
                    try { modelsWrap.innerHTML = ''; } catch (e) { }
                    try { if (brandWrap) brandWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
                    try { if (backBtn.__masterModelsBackHandler) { backBtn.removeEventListener('click', backBtn.__masterModelsBackHandler); delete backBtn.__masterModelsBackHandler; } } catch (e) { }
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
                    try {
                        if (created && backBtn && backBtn.parentNode) backBtn.parentNode.removeChild(backBtn);
                        else if (backBtn) backBtn.style.display = backBtn.__savedDisplay || '';
                    } catch (e) { }
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
                try { backBtn.style.display = ''; } catch (e) { }
            }
        } catch (e) { }

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
            } catch (e) { }
            grid.appendChild(mcard);
        });
        modelsWrap.appendChild(grid);
        try { modelsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
    }
    async function init() { }

    window.appMasterUI = { init, renderMasterPage, showModelsForBrand };
})();
