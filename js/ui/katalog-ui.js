/* katalog-ui.js — renamed from master-ui.js/masterUI.js (logic unchanged) */

(function () {
    const containerId = 'katalog';
    const container = document.getElementById(containerId);

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function titleCase(s) {
        if (!s) return '';
        return String(s).toLowerCase().split(/\s+/).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
    }

    // special casing for brand/model capitalization (e.g. 'Iphone' -> 'iPhone')
    function fixIphoneCapitalization(s) {
        if (!s && s !== 0) return '';
        return String(s).replace(/\bIphone\b/ig, 'iPhone');
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

    // Parse spesifikasi (JSONB stored as object or JSON string) safely and
    // return requested nested property. When property not found, return empty string.
    function safeGetSpec(spec, path) {
        if (!spec) return '';
        let obj = spec;
        try {
            if (typeof spec === 'string') obj = JSON.parse(spec);
        } catch (e) { /* ignore parse errors and treat as plain string below */ }
        // if it's still a string, return empty because we expect object-based specs
        if (typeof obj !== 'object' || obj === null) return '';
        try {
            const parts = path.split('.');
            let cur = obj;
            for (const p of parts) {
                if (!cur) return '';
                // support keys with spaces by direct lookup
                cur = cur[p] !== undefined ? cur[p] : cur[p.replace(/\s+/g, ' ')];
            }
            return cur === undefined || cur === null ? '' : String(cur);
        } catch (e) { return ''; }
    }

    function extractFirstValue(val) {
        if (!val && val !== 0) return '';
        const s = String(val);
        // split on comma, slash or semicolon and take the first non-empty segment
        const parts = s.split(/[,;/\\|]/).map(p => p.trim()).filter(Boolean);
        return parts.length ? parts[0] : s.trim();
    }

    // Normalize and shorten spec values for display on compact cards.
    // - collapse multiple spaces, replace underscores
    // - optionally truncate to keep the card compact
    function normalizeSpecValue(val, maxLen = 36) {
        if (!val && val !== 0) return '';
        let s = String(val).trim();
        s = s.replace(/[_]+/g, ' ');
        // collapse horizontal whitespace but preserve newlines so we can explicitly
        // control line breaks (tidySensorsText inserts '\n')
        s = s.replace(/[^\S\r\n]+/g, ' ');
        // remove surrounding commas or slashes
        s = s.replace(/^[,;\/\\|\s]+|[,;\/\\|\s]+$/g, '');
        if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…';
        return s;
    }

    // Tidy sensors text so that explanatory parenthesis move to the next line.
    // Example: 'Fingerprint (under display)' -> 'Fingerprint\n(under display)'
    function tidySensorsText(raw) {
        if (!raw && raw !== 0) return '';
        let s = String(raw);
        // normalize spacing first
        s = s.replace(/\s+/g, ' ').trim();
        // if there's a parenthetical and some leading text, move '(' to a new line
        // but only when the parenthetical is explanatory (length > 0)
        // preserve existing explicit newlines
        if (s.indexOf('\n') === -1) {
            const m = s.match(/^(.*?)(\s*)\((.+)\)\s*$/);
            if (m && m[1].trim()) {
                const before = m[1].trim();
                const inside = m[3].trim();
                return before + '\n(' + inside + ')';
            }
        } else {
            // already contains newline(s) - ensure the '(' starts on its own line if it follows text
            return s.replace(/^(.*)\s*\((.+)\)\s*$/m, (full, a, b) => { return a.trim() + '\n(' + b.trim() + ')'; });
        }
        return s;
    }

    // Format Internal spec from strings like:
    // "128GB 4GB RAM, 128GB 8GB RAM, 256GB 6GB RAM"
    // into: "4 GB / 128 GB, 8 GB / 128 GB, 6 GB / 256 GB"
    function formatInternal(raw) {
        if (!raw) return '';
        const s = String(raw).trim();
        if (!s) return '';
        // split entries by comma or semicolon
        const entries = s.split(/[,;]+/).map(e => e.trim()).filter(Boolean);
        const formatted = entries.map(e => {
            // try to find RAM and Storage tokens. We'll look for patterns like '128GB' and '4GB' and words 'RAM'
            // extract all tokens like numbers+GB or numbers + 'GB'
            const gbMatches = Array.from(e.matchAll(/(\d+(?:\.\d+)?)(?:\s*)GB/ig)).map(m => m[1]);
            // gbMatches may contain storage then ram or ram then storage; use heuristics:
            if (gbMatches.length >= 2) {
                // choose pairing: if first number larger than second, treat first as storage
                const a = Number(gbMatches[0]);
                const b = Number(gbMatches[1]);
                let storage = gbMatches[0];
                let ram = gbMatches[1];
                if (a < b) { storage = gbMatches[1]; ram = gbMatches[0]; }
                // use non-breaking spaces so the entry isn't wrapped in the middle
                return `${ram}\u00A0GB\u00A0/\u00A0${storage}\u00A0GB`;
            }
            // fallback: try to parse patterns like '128GB 4GB RAM' where tokens separated by space
            const tokens = e.split(/\s+/).filter(Boolean);
            // find first token that looks like RAM (small value) and storage (larger value)
            const allGbs = tokens.map(t => { const m = t.match(/(\d+(?:\.\d+)?)(?:\s*)GB/i); return m ? Number(m[1]) : null; }).filter(v => v !== null);
            if (allGbs.length >= 2) {
                const sorted = [...allGbs].sort((x, y) => x - y);
                const ram = sorted[0];
                const storage = sorted[sorted.length - 1];
                return `${ram}\u00A0GB\u00A0/\u00A0${storage}\u00A0GB`;
            }
            // last fallback: return original trimmed with normalized spacing (add space before GB)
            // normalize spacing and use NBSP to avoid mid-entry breaks
            return e.replace(/(\d+(?:\.\d+)?)GB/ig, '$1\u00A0GB');
        });
        // join with a zero-width space after comma so line breaks are allowed only after commas
        return formatted.join(',\u200B ');
    }

    // open modal to show large image and full specs (formatted)
    function openSpecModal(title, imageUrl, specObj) {
        try {
            const modal = document.createElement('div');
            modal.className = 'simple-modal modal';
            modal.setAttribute('aria-hidden', 'false');
            const specJson = (typeof specObj === 'string') ? specObj : JSON.stringify(specObj, null, 2);
            modal.innerHTML = `
                <div class="modal-backdrop" data-action="close"></div>
                <div class="modal-window" style="width: min(86vw, 700px); max-width: calc(100% - 32px);">
                    <div class="modal-header"><h3>${escapeHtml(title || 'Detail Model')}</h3><button class="modal-close" aria-label="Tutup">×</button></div>
                    <div class="modal-body">
                        <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                            <div style="flex:1 1 320px;min-width:220px;max-width:520px;">
                                ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="width:100%;height:auto;border-radius:8px;object-fit:contain;"/>` : '<div style="width:100%;height:220px;border-radius:8px;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;color:var(--muted);">Tidak Ada Gambar</div>'}
                            </div>
                            <div style="flex:1 1 260px;min-width:220px;max-width:560px;">
                                <pre style="white-space:pre-wrap;background:var(--surface);padding:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.04);max-height:60vh;overflow:auto;font-size:13px;">${escapeHtml(specJson)}</pre>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions"><button type="button" class="btn btn-primary close-spec">Tutup</button></div>
                </div>
            `;
            document.body.appendChild(modal);
            try { document.body.classList.add('modal-open'); } catch (e) { }
            modal.querySelector('.modal-backdrop').addEventListener('click', () => { closeModalByEl(modal); });
            modal.querySelector('.modal-close').addEventListener('click', () => { closeModalByEl(modal); });
            modal.querySelector('.close-spec').addEventListener('click', () => { closeModalByEl(modal); });
        } catch (e) { console.error('openSpecModal error', e); }
    }

    // Close and remove modal element (same behavior used by units-ui.js)
    function closeModalByEl(el) {
        if (!el) return;
        el.setAttribute('aria-hidden', 'true');
        try { document.body.classList.remove('modal-open'); } catch (e) { }
        if (el.parentNode) el.parentNode.removeChild(el);
    }

    async function fetchKatalogUnits() {
        try {
            const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
            if (!sup) return [];
            try {
                // prefer katalog table when available
                if (typeof window.tableExists === 'function') {
                    const okK = await window.tableExists('katalog', sup);
                    if (okK) {
                        const r = await sup.from('katalog').select('*').limit(2000);
                        if (!r.error) return r.data || [];
                    }
                    const ok = await window.tableExists('master_unit', sup);
                    if (!ok) return [];
                }
            } catch (e) { }
            const res = await sup.from('master_unit').select('*').limit(2000);
            if (res.error) return [];
            return res.data || [];
        } catch (e) { return []; }
    }

    async function renderKatalogPage() {
        if (!container) return;
        try {
            const card = container.querySelector('.card');
            if (!card) return;
            const existing = card.querySelector('.card-body');
            if (existing) existing.remove();

            const cb = document.createElement('div');
            cb.className = 'card-body';

            const katalogRows = await fetchKatalogUnits();

            const brandsMap = {};
            (katalogRows || []).forEach(m => {
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
            brandWrap.className = 'brand-cards katalog-brands items-grid';

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

            // enforce a specific display order for brands so the catalog shows
            // brands in the requested sequence regardless of alphabetical order
            const preferredOrder = ['Apple', 'Samsung', 'Oppo', 'Vivo', 'Infinix', 'Xiaomi', 'Realme', 'Tecno', 'Itel', 'Asus', 'Motorola', 'Huawei'];
            const orderMap = {};
            preferredOrder.forEach((v, i) => { orderMap[v.toLowerCase()] = i; });
            Object.values(brandsMap).sort((a, b) => {
                const ak = (a.display || '').toString().toLowerCase();
                const bk = (b.display || '').toString().toLowerCase();
                const ai = (orderMap.hasOwnProperty(ak) ? orderMap[ak] : 999);
                const bi = (orderMap.hasOwnProperty(bk) ? orderMap[bk] : 999);
                if (ai !== bi) return ai - bi;
                // fallback to localeCompare when both are equal or not in map
                return a.display.localeCompare(b.display, 'id');
            }).forEach(entry => {
                const cardB = document.createElement('div');
                cardB.className = 'item-card compact modern brand-card katalog-brand';
                cardB.dataset.brand = entry.key;
                const count = (entry.rows && entry.rows.length) ? entry.rows.length : 0;
                // store count on dataset and render compact card showing only brand logo
                cardB.dataset.count = String(count);
                cardB.innerHTML = `
                    <div class="card-main">
                        <div class="img-wrap"></div>
                    </div>
                `;
                brandWrap.appendChild(cardB);
                try {
                    const imgWrap = cardB.querySelector('.img-wrap');
                    // add special class for Apple to fine-tune vertical alignment
                    try {
                        const d = (entry.display || '').toString().toLowerCase();
                        if (d.indexOf('apple') !== -1) imgWrap.classList.add('brand-apple');
                        if (d.indexOf('huawei') !== -1) imgWrap.classList.add('brand-huawei');
                        if (d.indexOf('itel') !== -1) imgWrap.classList.add('brand-itel');
                        if (d.indexOf('vivo') !== -1) imgWrap.classList.add('brand-vivo');
                    } catch (e) { }
                    insertBrandLogo(imgWrap, entry.display);
                } catch (e) { }
                cardB.addEventListener('click', async () => { showModelsForBrand(entry.display, entry.rows, cardB); });
            });

            cb.appendChild(brandWrap);

            try {
                const selectRow = document.querySelector('#header-dropdowns .select-row');
                if (selectRow) {
                    let mh = selectRow.querySelector('.katalog-header');
                    if (!mh) {
                        mh = document.createElement('div');
                        mh.className = 'katalog-header';
                        mh.style.display = 'inline-flex';
                        mh.style.alignItems = 'center';
                        mh.style.gap = '8px';
                        const title = document.createElement('h3');
                        title.className = 'katalog-header-title';
                        title.textContent = 'Katalog';
                        title.style.margin = '0';
                        title.style.fontSize = '16px';
                        mh.appendChild(title);
                        const logoWrap = document.createElement('div');
                        logoWrap.className = 'katalog-header-logo';
                        logoWrap.style.display = 'none';
                        mh.appendChild(logoWrap);
                        // stock area for selected brand (moved from individual cards)
                        const stockWrap = document.createElement('div');
                        stockWrap.className = 'katalog-header-stock';
                        stockWrap.style.display = 'none';
                        mh.appendChild(stockWrap);
                        selectRow.insertBefore(mh, selectRow.firstChild.nextSibling || null);
                    } else {
                        const title = mh.querySelector('.katalog-header-title');
                        if (title) title.textContent = 'Katalog';
                    }
                }
            } catch (e) { }

            const modelsWrap = document.createElement('div');
            modelsWrap.className = 'brand-models';
            cb.appendChild(modelsWrap);

            try { const staticTitle = card.querySelector('h3'); if (staticTitle) staticTitle.parentNode && staticTitle.parentNode.removeChild(staticTitle); } catch (e) { }

            card.appendChild(cb);
        } catch (e) { console.error('renderKatalogPage error', e); }
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
                const mh = selectRow.querySelector('.katalog-header');
                if (mh) {
                    const lw = mh.querySelector('.katalog-header-logo');
                    const stockWrap = mh.querySelector('.katalog-header-stock');
                    if (lw) {
                        lw.innerHTML = '';
                        const src = brandToLogoSrc(brandName);
                        if (src) {
                            const img = document.createElement('img');
                            img.src = src;
                            img.alt = brandName || 'brand';
                            img.className = 'katalog-header-brand-logo';
                            // add class for specific brands header logo too
                            try {
                                const bn = (brandName || '').toString().toLowerCase();
                                if (bn.indexOf('apple') !== -1) img.classList.add('brand-apple');
                                if (bn.indexOf('huawei') !== -1) img.classList.add('brand-huawei');
                                if (bn.indexOf('itel') !== -1) img.classList.add('brand-itel');
                                if (bn.indexOf('vivo') !== -1) img.classList.add('brand-vivo');
                            } catch (e) { }
                            lw.appendChild(img);
                            lw.style.display = '';
                        } else { lw.style.display = 'none'; }
                    }
                    if (stockWrap) {
                        try { stockWrap.textContent = (rows && rows.length) ? ('Tersedia ' + rows.length + ' model') : ''; stockWrap.style.display = (rows && rows.length) ? '' : 'none'; } catch (e) { }
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
                try { if (backBtn.__katalogModelsBackHandler) { backBtn.removeEventListener('click', backBtn.__katalogModelsBackHandler); delete backBtn.__katalogModelsBackHandler; } } catch (e) { }
                try { if (backBtn.__katalogModelsBackHandler) { backBtn.removeEventListener('click', backBtn.__katalogModelsBackHandler); delete backBtn.__katalogModelsBackHandler; } } catch (e) { }

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
                    try { if (window.appKatalogUI && typeof window.appKatalogUI.renderKatalogPage === 'function') window.appKatalogUI.renderKatalogPage(); } catch (e) { }
                    try { modelsWrap.innerHTML = ''; } catch (e) { }
                    try { if (brandWrap) brandWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
                    try { if (backBtn.__katalogModelsBackHandler) { backBtn.removeEventListener('click', backBtn.__katalogModelsBackHandler); delete backBtn.__katalogModelsBackHandler; } } catch (e) { }
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
                        const mh = document.querySelector('#header-dropdowns .select-row .katalog-header');
                        if (mh) {
                            const lw = mh.querySelector('.katalog-header-logo');
                            if (lw) lw.style.display = 'none';
                            const sw = mh.querySelector('.katalog-header-stock'); if (sw) sw.style.display = 'none';
                        }
                    } catch (e) { }
                };

                backBtn.addEventListener('click', restoreBrands);
                backBtn.__katalogModelsBackHandler = restoreBrands;
                try { backBtn.style.display = ''; } catch (e) { }
            }
        } catch (e) { }

        const grid = document.createElement('div');
        grid.className = 'models-grid items-grid';
        (rows || []).forEach(r => {
            const mcard = document.createElement('div');
            mcard.className = 'item-card compact modern model-card';
            // prepare specification values
            const spec = r.spesifikasi || r.specs || r.spec || null;
            // try to safely read nested values like Memory.Internal, Comms.USB, Features.Sensors, Platform.OS
            const internalRaw = safeGetSpec(spec, 'Memory.Internal') || safeGetSpec(spec, 'Memory.internal') || safeGetSpec(spec, 'memory.internal') || '';
            const usbRaw = safeGetSpec(spec, 'Comms.USB') || safeGetSpec(spec, 'Comms.Usb') || safeGetSpec(spec, 'comms.usb') || '';
            const sensorsRaw = safeGetSpec(spec, 'Features.Sensors') || safeGetSpec(spec, 'Features.sensors') || safeGetSpec(spec, 'features.sensors') || '';
            const osRaw = safeGetSpec(spec, 'Platform.OS') || safeGetSpec(spec, 'Platform.Os') || safeGetSpec(spec, 'platform.os') || '';
            const internalVal = formatInternal(internalRaw);
            const usbVal = normalizeSpecValue(extractFirstValue(usbRaw), 28);
            // For sensors, first extract raw first value, then tidy parentheses placement,
            // then normalize and truncate for display.
            const sensorsRawFirst = extractFirstValue(sensorsRaw);
            const sensorsMoved = tidySensorsText(sensorsRawFirst);
            const sensorsVal = normalizeSpecValue(sensorsMoved, 28);
            const sensorsValTidy = sensorsVal;
            const osVal = normalizeSpecValue(extractFirstValue(osRaw), 28);

            // title and stock/variant rendering
            const rawTitle = (r.nama_model || r.kode_model || '');
            const cardTitle = fixIphoneCapitalization(titleCase(rawTitle));
            const variantText = (r.variant || r.stok || r.stock || '');

            mcard.innerHTML = `
                <div class="card-main">
                    <div class="img-wrap"></div>
                    <div class="card-meta">
                        <div class="card-title">${escapeHtml(cardTitle)}</div>
                        <div class="card-stock badge">${escapeHtml(variantText || '')}</div>
                        <div class="card-spec-summary small">
                            <div class="spec-col"><small><strong>Internal:</strong> <span class="spec-val spec-internal">${escapeHtml(internalVal || '-')}</span></small></div>
                            <div class="spec-col"><small><strong>USB:</strong> <span class="spec-val spec-usb">${escapeHtml(usbVal || '-')}</span></small></div>
                            <div class="spec-col"><small><strong>Sensors:</strong> <span class="spec-val spec-sensors">${escapeHtml(sensorsValTidy || '-')}</span></small></div>
                            <div class="spec-col"><small><strong>OS:</strong> <span class="spec-val spec-os">${escapeHtml(osVal || '-')}</span></small></div>
                        </div>
                    </div>
                </div>
                <div class="card-details" aria-hidden="true">
                    <div class="details-body specs-grid">
                        <p><strong>Internal:</strong> <span class="spec-val spec-internal">${escapeHtml(internalVal || '-')}</span></p>
                        <p><strong>USB:</strong> <span class="spec-val spec-usb">${escapeHtml(usbVal || '-')}</span></p>
                        <p><strong>Sensors:</strong> <span class="spec-val spec-sensors">${escapeHtml(sensorsValTidy || '-')}</span></p>
                        <p><strong>OS:</strong> <span class="spec-val spec-os">${escapeHtml(osVal || '-')}</span></p>
                    </div>
                </div>
            `;
            try {
                const imgWrap = mcard.querySelector('.img-wrap');
                // small loading spinner while we attach image/placeholder
                const spinner = document.createElement('div');
                spinner.className = 'img-spinner';
                imgWrap.appendChild(spinner);
                if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);

                // prefer gambar_url from katalog table, fallbacks to common names
                const imgUrl = (r && (r.gambar_url || r.gambar || r.image_url || r.foto)) || null;
                if (imgUrl) {
                    const img = document.createElement('img');
                    img.className = 'card-thumb';
                    img.alt = (r && (r.nama_model || r.kode_model)) ? String(r.nama_model || r.kode_model) : 'model';
                    img.loading = 'lazy';
                    img.src = imgUrl;
                    // on error, hide img and show placeholder
                    img.addEventListener('error', function () { try { this.onerror = null; this.style.display = 'none'; const ph = document.createElement('div'); ph.className = 'card-thumb placeholder'; ph.textContent = 'Tidak Ada Gambar'; imgWrap.appendChild(ph); } catch (e) { } });
                    imgWrap.appendChild(img);
                } else {
                    const ph = document.createElement('div');
                    ph.className = 'card-thumb placeholder';
                    ph.textContent = 'Tidak Ada Gambar';
                    imgWrap.appendChild(ph);
                }
            } catch (e) { }
            // buka modal detail saat klik/tap: tampilkan gambar besar + spesifikasi lengkap
            mcard.addEventListener('click', (ev) => {
                if (ev.target.closest('.btn') || ev.target.closest('button')) return;
                // determine image url fallback
                const imgUrl = (r && (r.gambar_url || r.gambar || r.image_url || r.foto)) || '';
                const title = (r.nama_model || r.kode_model || '') || '';
                // prefer passing the raw spesifikasi object/string from DB so modal shows full content
                const fullSpec = r.spesifikasi || r.specs || r.spec || r;
                openSpecModal(title, imgUrl, fullSpec);
            });

            mcard.addEventListener('touchend', (ev) => { /* no-op: click already handles modal, keep for compatibility */ }, { passive: true });

            grid.appendChild(mcard);
        });
        modelsWrap.appendChild(grid);
        try { modelsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
    }
    async function init() { }

    window.appKatalogUI = { init, renderKatalogPage, showModelsForBrand };
})();
