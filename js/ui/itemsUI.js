/* itemsUI.js — rendering items and applying filters */

(function () {
    const itemsList = document.getElementById('items-list');
    const searchInput = document.getElementById('searchInput');
    // buttons that open panels (replaced selects)
    const resetKategori = document.getElementById('resetKategori');
    const resetStok = document.getElementById('resetStok');
    const resetJenis = document.getElementById('resetJenis');
    const panelKategori = document.getElementById('panel-kategori');
    const panelStok = document.getElementById('panel-stok');
    const panelJenis = document.getElementById('panel-jenis');

    // Shared UI state (define early so helper functions can use them safely)
    let allItems = [];
    let filterBackdrop = null;

    // Normalize an item row to legacy-shaped keys so existing UI code keeps working
    function normalizeItem(row) {
        if (!row) return row;
        return Object.assign({}, row, {
            // canonical ids / codes
            id: row.id_sparepart || row.id || row.kode_item || row.item_code || null,
            kode_item: row.kode_item || row.item_code || row.kode_sparepart || null,
            item_code: row.item_code || row.kode_item || row.kode_sparepart || null,
            // names
            nama_item: row.nama_item || row.name || row.nama_sparepart || row.nama || null,
            name: row.name || row.nama_item || row.nama_sparepart || row.nama || null,
            // stock
            stok_item: (row.stok !== undefined && row.stok !== null) ? Number(row.stok) : ((row.stok_item !== undefined && row.stok_item !== null) ? Number(row.stok_item) : ((row.stock !== undefined && row.stock !== null) ? Number(row.stock) : 0)),
            stock: (row.stock !== undefined && row.stock !== null) ? Number(row.stock) : ((row.stok !== undefined && row.stok !== null) ? Number(row.stok) : ((row.stok_item !== undefined && row.stok_item !== null) ? Number(row.stok_item) : 0)),
            // price/cost
            jasa_item: (row.jasa_item !== undefined && row.jasa_item !== null) ? Number(row.jasa_item) : ((row.harga_jual !== undefined && row.harga_jual !== null) ? Number(row.harga_jual) : ((row.sale_price !== undefined && row.sale_price !== null) ? Number(row.sale_price) : null)),
            cost_price: row.harga_beli ?? row.cost_price ?? null,
            sale_price: row.harga_jual ?? row.sale_price ?? null,
            // kategori / sumber / info
            jenis_item: row.jenis_item || row.kategori || null,
            sumber_item: row.sumber_item || row.lokasi_penyimpanan || null,
            informasi_tambahan_item: row.informasi_tambahan_item || row.catatan || null,
            image_url: row.image_url || row.foto_sebelum || row.foto || null,
            // keep raw
            _raw: row
        });
    }


    // Helpers: get unique values for a field from loaded items
    function getUniqueValues(field) {
        if (!allItems || !allItems.length) return [];
        const s = new Set(allItems.map(i => (i[field] || '').toString()).filter(Boolean));
        return Array.from(s);
    }

    function populateSelectOptions(selectEl, values, selectedValue) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        // add empty placeholder option
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Pilih --';
        selectEl.appendChild(placeholder);
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            if (selectedValue && String(selectedValue) === String(v)) opt.selected = true;
            selectEl.appendChild(opt);
        });
        // if selectedValue provided but not in list, ensure it's present and selected
        if (selectedValue && !values.includes(selectedValue)) {
            const opt = document.createElement('option');
            opt.value = selectedValue;
            opt.textContent = selectedValue;
            opt.selected = true;
            selectEl.appendChild(opt);
        }
    }

    // Generate a simple kode_item to satisfy DB not-null constraint
    function generateKodeItem() {
        const t = Date.now().toString(36);
        const r = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `KD-${t}-${r}`;
    }

    // Generate kode based on jenis with prefix mapping.
    // Prefix mapping: Sparepart -> SP, Jasa -> JS, Aksesoris -> AS
    // Numeric suffix is next sequence based on existing kode_item values for that prefix.
    // Assumption: numeric suffix is zero-padded to width 5 (e.g. SP00001, AS00012).
    function generateKodeByJenis(jenis) {
        const j = (jenis || '').toString().toLowerCase();
        let prefix = 'OT';
        if (j.includes('spare') || j.includes('sparepart')) prefix = 'SP';
        else if (j.includes('jasa')) prefix = 'JS';
        else if (j.includes('aksesor') || j.includes('aksesoris') || j.includes('aksesori')) prefix = 'AS';

        // find max numeric suffix among allItems for this prefix
        let max = 0;
        const re = new RegExp('^' + prefix + '(0*)(\\d+)$');
        (allItems || []).forEach(it => {
            const k = (it.kode_item || '').toString();
            const m = k.match(re);
            if (m && m[2]) {
                const num = parseInt(m[2], 10);
                if (!isNaN(num) && num > max) max = num;
            }
        });
        const next = max + 1;
        const width = 4; // pad to 4 digits by default (e.g. SP0001)
        const suffix = String(next).padStart(width, '0');
        return `${prefix}${suffix}`;
    }

    // Upload image file to Supabase Storage (bucket 'uploads').
    // Returns public URL string or null on failure / not available.
    async function uploadImageFile(file) {
        if (!file) return null;
        // prefer helper getSupabase if available for safer initialization check
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup || !sup.storage) return null;
        const bucket = 'uploads';
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `items/${filename}`;
        try {
            const { error: uploadError } = await sup.storage.from(bucket).upload(path, file);
            if (uploadError) {
                console.error('Supabase upload error', uploadError);
                return null;
            }
            const { data } = sup.storage.from(bucket).getPublicUrl(path);
            return data && data.publicUrl ? data.publicUrl : null;
        } catch (e) {
            console.error('Upload failed', e);
            return null;
        }
    }
    async function loadAndRenderItems() {
        try {
            let rows = [];
            if (window.itemsApiNew && typeof window.itemsApiNew.listSparepart === 'function') {
                rows = await window.itemsApiNew.listSparepart();
                allItems = (rows || []).map(normalizeItem);
            } else if (window.itemsApi && typeof window.itemsApi.listItems === 'function') {
                rows = await window.itemsApi.listItems();
                allItems = (rows || []).map(normalizeItem);
            } else {
                throw new Error('No items API available');
            }
            renderItems(allItems);
            fillFilterOptions(allItems);
        } catch (err) {
            console.error('Failed to load items', err);
            showDebugMessage && showDebugMessage('items-list', '❌ Error loading items: ' + (err.message || err), true);
        }
    }

    function renderItems(items) {
        if (!itemsList) return;
        itemsList.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'items-grid grid-2cols';

        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'item-card compact modern';
            // Prefer canonical item_code as stable identifier; fallback to legacy kode_item or id
            card.dataset.itemId = item.item_code || item.kode_item || item.id;

            // Build card inner structure (details static HTML, image area created programmatically)
            card.innerHTML = `
                                            <div class="card-main">
                                                <div class="img-wrap"></div>
                                                <div class="card-meta">
                                                    <div class="card-title">${item.name || item.nama_item || 'Tanpa Nama'}</div>
                                                    <div class="card-stock">Stok: <span class="stock-value">${(item.stock ?? item.stok_item) ?? '-'}</span></div>
                                                </div>
                                            </div>
                                            <div class="card-details" aria-hidden="true">
                                                <div class="details-body">
                                                    <p><strong>Kategori:</strong> ${item.jenis_item || '-'}</p>
                                                    <p><strong>Kondisi:</strong> ${item.kondisi_item || '-'}</p>
                                                    <p><strong>Harga:</strong> ${item.jasa_item ? 'Rp ' + Number(item.jasa_item).toLocaleString() : '-'}</p>
                                                </div>
                                                <div class="details-actions">
                                                    <button class="btn btn-secondary edit-btn">Edit</button>
                                                    <button class="btn btn-secondary delete-btn">Hapus</button>
                                                </div>
                                            </div>
                                    `;

            // Image handling: show spinner, lazy-load image if available, fallback to placeholder text.
            const imgWrap = card.querySelector('.img-wrap');
            if (imgWrap) {
                // spinner container
                const spinner = document.createElement('div');
                spinner.className = 'img-spinner';
                imgWrap.appendChild(spinner);

                const imgSrc = (item.image_url || '').trim();
                if (imgSrc) {
                    const img = document.createElement('img');
                    img.className = 'card-thumb';
                    img.loading = 'lazy';
                    img.alt = item.nama_item || 'Item';
                    // set src after attaching listeners to avoid race
                    img.addEventListener('load', () => {
                        // remove spinner and show image
                        if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                        imgWrap.appendChild(img);
                    });
                    img.addEventListener('error', () => {
                        // remove spinner and show placeholder
                        if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                        const ph = document.createElement('div');
                        ph.className = 'card-thumb placeholder';
                        ph.textContent = 'Tidak Ada Gambar';
                        imgWrap.appendChild(ph);
                    });
                    // finally set src (triggers load/error)
                    img.src = imgSrc;
                } else {
                    // No src: replace spinner with placeholder
                    if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                    const ph = document.createElement('div');
                    ph.className = 'card-thumb placeholder';
                    ph.textContent = 'Tidak Ada Gambar';
                    imgWrap.appendChild(ph);
                }
            }

            // Toggle details on click/touch
            card.addEventListener('click', (ev) => {
                // prevent click from buttons inside toggling collapse
                if (ev.target.closest('.edit-btn') || ev.target.closest('.delete-btn')) return;
                const isOpen = card.classList.toggle('expanded');
                const details = card.querySelector('.card-details');
                if (details) details.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
                // debug: log transform/boxShadow state for troubleshooting persistent lift on mobile
                try { console.debug('card toggle', { id: card.dataset.itemId, expanded: isOpen, className: card.className, style: { transform: card.style.transform, boxShadow: card.style.boxShadow } }); } catch (e) { }
                // If we just closed the card, ensure any inline transforms/shadows applied by JS/CSS are cleared so the card returns flush
                if (!isOpen) {
                    // remove any inline transform/box-shadow
                    card.style.transform = '';
                    card.style.boxShadow = '';
                    // force reflow to ensure the browser clears the visual state
                    // reading offsetHeight forces reflow
                    void card.offsetHeight;
                    // also remove any lingering style attribute if empty
                    if (!card.getAttribute('style')) card.removeAttribute('style');
                }
            });

            // Touchend: some mobile browsers may leave :active or inline styles set after touch interaction
            card.addEventListener('touchend', (ev) => {
                // small timeout to let any click handlers run first
                setTimeout(() => {
                    if (!card.classList.contains('expanded')) {
                        card.style.transform = '';
                        card.style.boxShadow = '';
                        void card.offsetHeight;
                        if (!card.getAttribute('style')) card.removeAttribute('style');
                        try { console.debug('cleared lingering styles on touchend for', card.dataset.itemId); } catch (e) { }
                    }
                }, 50);
            }, { passive: true });

            // Edit handler: show inline edit form inside details
            const editBtn = card.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await openEditForm(card, item);
                });
            }

            // Delete handler: confirm and call API
            const deleteBtn = card.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm('Hapus item ini?')) return;
                    try {
                        // prefer canonical item_code, fallback to kode_item/id
                        const key = item.item_code || item.kode_item || item.id;
                        await itemsApi.deleteItem(key);
                        // reload list
                        await loadAndRenderItems();
                    } catch (err) {
                        console.error('Gagal menghapus item', err);
                        alert('Gagal menghapus item: ' + (err.message || err));
                    }
                });
            }

            grid.appendChild(card);
        });

        // If there are no items, show a friendly empty-state placeholder
        if (!items || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state empty-centered';
            empty.innerHTML = `<p>Belum ada Item.</p>`;
            grid.appendChild(empty);
        }

        itemsList.appendChild(grid);
    }

    function closeAllPanels() {
        // Prefer centralized close behavior if available so blur-on-close and backdrop
        // handling are consistent across modules.
        try {
            if (window.filterPanels && typeof window.filterPanels.closeAll === 'function') {
                window.filterPanels.closeAll();
                return;
            }
        } catch (e) { /* fallthrough to legacy fallback */ }

        // Legacy fallback: hide known panels and backdrop
        [[resetKategori, panelKategori], [resetStok, panelStok], [resetJenis, panelJenis]].forEach(([btn, panel]) => {
            if (!btn || !panel) return;
            try { btn.setAttribute('aria-expanded', 'false'); } catch (e) { }
            try { panel.setAttribute('aria-hidden', 'true'); } catch (e) { }
            try { panel.style.display = 'none'; } catch (e) { }
            // clear positioning
            try { panel.style.left = ''; } catch (e) { }
            try { panel.style.top = ''; } catch (e) { }
            try { panel.style.right = ''; } catch (e) { }
            try { panel.style.transform = ''; } catch (e) { }
        });
        if (filterBackdrop) filterBackdrop.style.display = 'none';
    }

    function togglePanel(button, panel) {
        if (!button || !panel) return;
        const open = button.getAttribute('aria-expanded') === 'true';
        closeAllPanels();
        if (!open) {
            // show backdrop
            if (filterBackdrop) filterBackdrop.style.display = 'block';
            button.setAttribute('aria-expanded', 'true');
            panel.setAttribute('aria-hidden', 'false');
            // show panel hidden to measure size and compute position
            panel.style.display = 'block';
            panel.style.visibility = 'hidden';
            panel.style.transform = 'none';
            // focus first input inside panel if any (deferred after positioning)

            // compute positioning relative to button
            const btnRect = button.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

            // desired left aligned to button
            let left = btnRect.left;
            // ensure panel not overflow right
            const margin = 8;
            if (left + panelRect.width + margin > vw) {
                left = Math.max(margin, vw - panelRect.width - margin);
            }

            // desired top below button
            let top = btnRect.bottom + 8;
            // if not enough space below, place above
            if (top + panelRect.height + margin > vh && (btnRect.top - panelRect.height - 8) > margin) {
                top = btnRect.top - panelRect.height - 8;
            }

            // set coordinates (position fixed coordinates use viewport origin)
            panel.style.left = Math.round(left) + 'px';
            panel.style.top = Math.round(top) + 'px';
            panel.style.visibility = 'visible';

            // focus first input inside panel if any (defer slightly to ensure visible)
            setTimeout(() => {
                const first = panel.querySelector('input, button');
                if (first) first.focus();
            }, 10);
        }
    }

    function buildPanelItem(idPrefix, type, value, label, checked) {
        // type: 'checkbox' or 'radio'
        const wrapper = document.createElement('label');
        wrapper.className = 'filter-option';
        const input = document.createElement('input');
        input.type = type;
        input.name = idPrefix;
        input.value = value;
        if (checked) input.checked = true;
        const span = document.createElement('span');
        span.textContent = label;
        wrapper.appendChild(input);
        wrapper.appendChild(span);
        return wrapper;
    }

    function fillFilterOptions(items) {
        if (!panelKategori || !panelJenis || !panelStok) return;
        // Determine whether panel-stok is acting as 'layanan' selector (for Jasa page)
        const stokBtnEl = document.querySelector('#resetStok');
        const stokAsLayanan = !!(stokBtnEl && stokBtnEl.dataset && stokBtnEl.dataset.mode === 'layanan');
        // Determine current active section to decide unit-mode rendering.
        // Using the active section is more robust than relying on lingering dataset flags.
        const activeId = document.querySelector('main section.active')?.id || '';
        const kategoriIsUnitMode = activeId === 'unit';
        const jenisIsUnitMode = activeId === 'unit';

        // Exclude service category 'Jasa' from item category filters and
        // exclude 'Digital' from kondisi filters (case-insensitive)
        // Build sorted arrays of unique values for stable UI ordering
        // Collect kategori values from normalized items. If kategori is missing for some
        // items, map them to a placeholder 'Tanpa Kategori' so the filter UI shows an option.
        const rawKats = items.map((i) => (i.jenis_item || i.kategori));
        const mappedKats = rawKats.map(k => (k === null || typeof k === 'undefined' || String(k).trim() === '') ? 'Tanpa Kategori' : k);
        const kategoriArr = Array.from(new Set(mappedKats.filter(Boolean).filter(v => String(v).toLowerCase() !== 'jasa'))).sort((a, b) => String(a).localeCompare(b, 'id', { sensitivity: 'base' }));
        const jenisArr = Array.from(new Set(items.map((i) => i.kondisi_item).filter(Boolean).filter(v => String(v).toLowerCase() !== 'digital'))).sort((a, b) => String(a).localeCompare(b, 'id', { sensitivity: 'base' }));
        const kategoriSet = new Set(kategoriArr);
        const jenisSet = new Set(jenisArr);

        // Kategori: either multi-select checkboxes (items) or single-select radio (unit)
        panelKategori.innerHTML = '';
        if (kategoriIsUnitMode) {
            // Unit page: show radio options Ponsel / Laptop (plus empty = Semua Kategori)
            const prev = panelKategori.querySelector('input:checked')?.value || '';
            const opts = [{ v: '', l: 'Semua Kategori' }, { v: 'Ponsel', l: 'Ponsel' }, { v: 'Laptop', l: 'Laptop' }];
            opts.forEach(opt => {
                const node = buildPanelItem('kategori', 'radio', opt.v, opt.l, prev === opt.v);
                const input = node.querySelector('input');
                // change handler (when value actually changes)
                input.addEventListener('change', () => {
                    applyFilters();
                    updateButtonLabelCounts();
                    closeAllPanels();
                });
                // click on the label should also close the panel even if the radio was already selected
                node.addEventListener('click', () => {
                    try { applyFilters(); updateButtonLabelCounts(); } catch (e) { }
                    try { closeAllPanels(); } catch (e) { }
                });
                panelKategori.appendChild(node);
            });
        } else {
            // default: multi-checkbox categories (items)
            const prevKategori = new Set(Array.from(panelKategori.querySelectorAll('input[type="checkbox"]')).filter(i => i.checked).map(i => i.value));
            const keepPrevKategori = prevKategori.size > 0;
            // iterate in sorted order to provide stable UI
            kategoriArr.forEach(k => {
                const checked = keepPrevKategori ? prevKategori.has(k) : true;
                const node = buildPanelItem('kategori', 'checkbox', k, k, checked);
                node.querySelector('input').addEventListener('change', (ev) => {
                    // enforce at least one checked
                    const all = Array.from(panelKategori.querySelectorAll('input[type="checkbox"]'));
                    const checkedNow = all.filter(i => i.checked);
                    if (checkedNow.length === 0) {
                        // prevent unchecking last: revert
                        ev.target.checked = true;
                        return;
                    }
                    applyFilters();
                    updateButtonLabelCounts();
                });
                panelKategori.appendChild(node);
            });
        }

        // Stok or Layanan: radio buttons with fixed options (single choice)
        const prevStok = panelStok.querySelector('input:checked')?.value || '';
        panelStok.innerHTML = '';
        if (stokAsLayanan) {
            // show layanan options — labels required: 'Semua Kategori', 'Jasa', 'Layanan'
            const layananOptions = [{ v: '', l: 'Semua Kategori' }, { v: 'Jasa', l: 'Jasa' }, { v: 'Layanan', l: 'Layanan' }];
            layananOptions.forEach(opt => {
                const node = buildPanelItem('stok', 'radio', opt.v, opt.l, prevStok === opt.v);
                const input = node.querySelector('input');
                input.addEventListener('change', () => {
                    applyFilters();
                    updateButtonLabelCounts();
                    closeAllPanels();
                    // If we're currently viewing the Jasa page, re-render jasa list to apply the layanan filter
                    try {
                        const activeId = document.querySelector('main section.active')?.id;
                        if (activeId === 'lainnya' && window.appJasaUI && typeof window.appJasaUI.renderList === 'function') {
                            window.appJasaUI.renderList();
                        }
                    } catch (e) { /* ignore */ }
                });
                // ensure clicking the label closes the panel even if value unchanged
                node.addEventListener('click', () => {
                    try { applyFilters(); updateButtonLabelCounts(); } catch (e) { }
                    try {
                        closeAllPanels();
                        const activeId = document.querySelector('main section.active')?.id;
                        if (activeId === 'lainnya' && window.appJasaUI && typeof window.appJasaUI.renderList === 'function') {
                            window.appJasaUI.renderList();
                        }
                    } catch (e) { /* ignore */ }
                });
                panelStok.appendChild(node);
            });
        } else {
            const stokOptions = [{ v: '', l: 'Semua Stok' }, { v: 'habis', l: 'Stok Habis' }, { v: 'tersedia', l: 'Masih Ada' }];
            stokOptions.forEach(opt => {
                const node = buildPanelItem('stok', 'radio', opt.v, opt.l, prevStok === opt.v);
                node.querySelector('input').addEventListener('change', () => {
                    applyFilters();
                    updateButtonLabelCounts();
                    closeAllPanels();
                });
                panelStok.appendChild(node);
            });
        }

        // Jenis/Kondisi: either multi-select checkboxes (items) or single-select radio (unit)
        panelJenis.innerHTML = '';
        if (jenisIsUnitMode) {
            const prev = panelJenis.querySelector('input:checked')?.value || '';
            const opts = [{ v: '', l: 'Semua Kondisi' }, { v: 'Baru', l: 'Baru' }, { v: 'Bekas', l: 'Bekas' }];
            opts.forEach(opt => {
                const node = buildPanelItem('jenis', 'radio', opt.v, opt.l, prev === opt.v);
                const input = node.querySelector('input');
                input.addEventListener('change', () => {
                    applyFilters();
                    updateButtonLabelCounts();
                    closeAllPanels();
                });
                node.addEventListener('click', () => {
                    try { applyFilters(); updateButtonLabelCounts(); } catch (e) { }
                    try { closeAllPanels(); } catch (e) { }
                });
                panelJenis.appendChild(node);
            });
        } else {
            const prevJenis = new Set(Array.from(panelJenis.querySelectorAll('input[type="checkbox"]')).filter(i => i.checked).map(i => i.value));
            const keepPrevJenis = prevJenis.size > 0;
            // iterate in sorted order
            jenisArr.forEach(j => {
                const checked = keepPrevJenis ? prevJenis.has(j) : true;
                const node = buildPanelItem('jenis', 'checkbox', j, j, checked);
                node.querySelector('input').addEventListener('change', (ev) => {
                    const all = Array.from(panelJenis.querySelectorAll('input[type="checkbox"]'));
                    const checkedNow = all.filter(i => i.checked);
                    if (checkedNow.length === 0) {
                        ev.target.checked = true;
                        return;
                    }
                    applyFilters();
                    updateButtonLabelCounts();
                });
                panelJenis.appendChild(node);
            });
        }

        // Status filter is handled by Unit page only; itemsUI does not build it here.

        // Update button labels with counts
        updateButtonLabelCounts();
    }

    function updateButtonLabelCounts() {
        // Kategori
        if (resetKategori && panelKategori) {
            // Determine mode by active section instead of dataset flags to avoid leakage
            const activeId = document.querySelector('main section.active')?.id || '';
            const isUnitKategori = activeId === 'unit';
            if (isUnitKategori) {
                const sel = panelKategori.querySelector('input[type="radio"]:checked');
                resetKategori.textContent = sel ? (sel.value === '' ? 'Kategori' : sel.value) : 'Kategori';
            } else {
                const total = panelKategori.querySelectorAll('input[type="checkbox"]').length;
                const checked = panelKategori.querySelectorAll('input[type="checkbox"]:checked').length;
                resetKategori.textContent = `Kategori` + (total ? ` (${checked})` : '');
            }
        }
        // Jenis/Kondisi
        if (resetJenis && panelJenis) {
            const activeId = document.querySelector('main section.active')?.id || '';
            const isUnitJenis = activeId === 'unit';
            if (isUnitJenis) {
                const sel = panelJenis.querySelector('input[type="radio"]:checked');
                resetJenis.textContent = sel ? (sel.value === '' ? 'Kondisi' : sel.value) : 'Kondisi';
            } else {
                const total = panelJenis.querySelectorAll('input[type="checkbox"]').length;
                const checked = panelJenis.querySelectorAll('input[type="checkbox"]:checked').length;
                resetJenis.textContent = `Kondisi` + (total ? ` (${checked})` : '');
            }
        }
        // Stok or Layanan (single) — show selected label
        if (resetStok && panelStok) {
            // If the stok control has been hidden for unit page, leave it untouched.
            const isHidden = resetStok.closest && resetStok.closest('.filter-wrap') && resetStok.closest('.filter-wrap').style.display === 'none';
            if (isHidden) return;
            const sel = panelStok.querySelector('input[type="radio"]:checked');
            const isLayanan = !!(resetStok.dataset && resetStok.dataset.mode === 'layanan');
            let label = 'Stok';
            if (isLayanan) {
                // when layanan mode: show selected label or default 'Semua Kategori'
                label = sel ? (sel.value === '' ? 'Semua Kategori' : sel.value) : 'Semua Kategori';
            } else {
                label = sel ? (sel.value === '' ? 'Stok' : (sel.value === 'habis' ? 'Stok Habis' : 'Masih Ada')) : 'Stok';
            }
            resetStok.textContent = label;
        }
        // Status label handled by Unit UI when applicable.
    }

    function applyFilters() {
        const search = (searchInput?.value || '').toLowerCase();
        // read categories from panel checkboxes (multi-select)
        let kategoriValues = [];
        // determine if panelKategori/panelJenis are in unit (single-select) mode
        // Use active section detection to avoid relying on dataset flags that may persist across navigation
        const activeId = document.querySelector('main section.active')?.id || '';
        const isUnitKategori = activeId === 'unit';
        const isUnitJenis = activeId === 'unit';
        if (panelKategori) {
            if (isUnitKategori) {
                const sel = panelKategori.querySelector('input[type="radio"]:checked');
                kategoriValues = sel && sel.value ? [sel.value] : [];
            } else {
                kategoriValues = Array.from(panelKategori.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value).filter(v => v !== '');
            }
        }
        const stok = (panelStok && panelStok.querySelector('input[type="radio"]:checked')?.value) || '';
        let jenis = '';
        if (panelJenis) {
            if (isUnitJenis) {
                jenis = panelJenis.querySelector('input[type="radio"]:checked')?.value || '';
            } else {
                // for multi-select jenis we won't use 'jenis' single value; keep existing behavior (empty => match all)
                jenis = panelJenis.querySelector('input[type="radio"]:checked')?.value || '';
            }
        }
        // Items page does not include Status filter (Unit handles status); ignore status here.

        const filtered = allItems.filter((i) => {
            const name = (i.nama_item || '').toString().toLowerCase();
            const matchSearch = !search || name.includes(search);
            const matchKategori = !kategoriValues.length || kategoriValues.includes(i.jenis_item);
            const matchJenis = !jenis || i.kondisi_item === jenis;
            const matchStok = !stok || (stok === 'habis' && (!i.stok_item || i.stok_item == 0)) || (stok === 'tersedia' && i.stok_item > 0);
            return matchSearch && matchKategori && matchJenis && matchStok;
        });

        renderItems(filtered);
    }

    async function openEditForm(card, item) {
        // Show edit form in a modal popup instead of inline details
        // Create modal container if not exists
        let modal = document.getElementById('edit-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edit-modal';
            modal.className = 'modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="modal-backdrop" data-action="close"></div>
                <div class="modal-window" role="dialog" aria-modal="true">
                    <button class="modal-close" aria-label="Tutup">×</button>
                    <div class="modal-content"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // close handlers
            modal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(modal));
            modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));
            // ESC to close modal
            document.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal(modal);
            });
        }

        const content = modal.querySelector('.modal-content');
        content.innerHTML = '';

        const form = document.createElement('form');
        form.className = 'edit-form';
        form.innerHTML = `
                                <div class="modal-header"><h3>Ubah Item</h3></div>
                                <label>Kode Item: <input name="kode_item" id="edit-kode" value="${(item.kode_item || '')}"></label>
                                <label>Nama: <input name="nama_item" id="edit-nama" required value="${(item.nama_item || '')}"></label>
                                <label>Kategori: <select name="jenis_item" id="edit-jenis"></select></label>
                                <label>Kondisi: <select name="kondisi_item" id="edit-kondisi"></select></label>
                                <label>Harga (Rp): <input name="jasa_item" type="number" min="0" value="${(item.jasa_item ?? '')}" required></label>
                                <label>Stok: <input name="stok_item" type="number" min="0" value="${(item.stok_item ?? 0)}"></label>
                                <label>Sumber: <input name="sumber_item" value="${(item.sumber_item || '')}"></label>
                                <label>Informasi Tambahan: <textarea name="informasi_tambahan_item">${(item.informasi_tambahan_item || '')}</textarea></label>
                                <label>Gambar: <input name="image_file" type="file" accept="image/jpeg,image/png,image/webp"></label>
                                <div class="image-preview" aria-hidden="true"></div>
                                <div class="modal-actions edit-actions">
                                    <button class="btn btn-secondary cancel-edit" type="button">Batal</button>
                                    <button class="btn btn-primary save-edit" type="submit">Simpan</button>
                                </div>
                        `;

        content.appendChild(form);

        // populate kategori & kondisi selects with unique values from loaded items
        const jenisValues = getUniqueValues('jenis_item');
        // filter out 'Digital' kondisi since digital items are not a physical condition we want to show
        const kondisiValues = getUniqueValues('kondisi_item').filter(v => String(v || '').trim().toLowerCase() !== 'digital');
        populateSelectOptions(form.querySelector('#edit-jenis'), jenisValues, item.jenis_item);
        populateSelectOptions(form.querySelector('#edit-kondisi'), kondisiValues, item.kondisi_item);

        // preview handling + wire cancel
        const previewEl = form.querySelector('.image-preview');
        const imgInput = form.querySelector('input[name="image_file"]');
        if (imgInput) {
            imgInput.addEventListener('change', (ev) => {
                const f = imgInput.files && imgInput.files[0];
                // validate size/type
                if (f) {
                    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
                    if (!allowed.includes(f.type)) {
                        alert('Jenis file tidak didukung. Gunakan JPG, PNG, atau WebP.');
                        imgInput.value = '';
                        previewEl.innerHTML = '';
                        previewEl.setAttribute('aria-hidden', 'true');
                        return;
                    }
                    const maxBytes = 4 * 1024 * 1024; // 4MB
                    if (f.size > maxBytes) {
                        alert('Ukuran file terlalu besar. Maksimal 4 MB.');
                        imgInput.value = '';
                        previewEl.innerHTML = '';
                        previewEl.setAttribute('aria-hidden', 'true');
                        return;
                    }
                    // show preview
                    const reader = new FileReader();
                    reader.onload = () => {
                        previewEl.innerHTML = `<img src="${reader.result}" alt="Preview" />`;
                        previewEl.setAttribute('aria-hidden', 'false');
                    };
                    reader.readAsDataURL(f);
                } else {
                    previewEl.innerHTML = '';
                    previewEl.setAttribute('aria-hidden', 'true');
                }
            });
        }

        const previewBusy = () => {
            if (!previewEl) return null;
            previewEl.innerHTML = `<div class="upload-indicator">Mengunggah…</div>`;
            previewEl.setAttribute('aria-hidden', 'false');
        };

        const previewDone = (url) => {
            if (!previewEl) return;
            if (url) previewEl.innerHTML = `<img src="${url}" alt="Preview" />`; else previewEl.innerHTML = '';
        };

        // wire cancel
        form.querySelector('.cancel-edit').addEventListener('click', (ev) => {
            ev.preventDefault();
            closeModal(modal);
        });

        // submit
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const formData = new FormData(form);
            // Build payload suitable for new schema
            const payloadNew = {};
            if (formData.has('nama_item')) payloadNew.nama_sparepart = formData.get('nama_item');
            if (formData.has('kode_item')) payloadNew.kode_sparepart = formData.get('kode_item') || null;
            if (formData.has('jenis_item')) payloadNew.kategori = formData.get('jenis_item') || null;
            if (formData.has('jasa_item')) payloadNew.harga_jual = formData.get('jasa_item') ? Number(formData.get('jasa_item')) : null;
            if (formData.has('stok_item')) payloadNew.stok = formData.get('stok_item') ? Number(formData.get('stok_item')) : 0;
            if (formData.has('sumber_item')) payloadNew.lokasi_penyimpanan = formData.get('sumber_item') || null;
            if (formData.has('informasi_tambahan_item')) payloadNew.catatan = formData.get('informasi_tambahan_item') || null;
            // handle image file upload if provided
            const fileInput = form.querySelector('input[name="image_file"]');
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                previewBusy();
                const uploaded = await uploadImageFile(fileInput.files[0]);
                previewDone(uploaded);
                if (uploaded) payloadNew.image_url = uploaded;
            } else if (item.image_url) {
                payloadNew.image_url = item.image_url;
            }
            try {
                // prefer new API when present
                const keyCandidate = item.id_sparepart || item.id || item.kode_item || item.item_code || (item._raw && (item._raw.id_sparepart || item._raw.id));
                if (window.itemsApiNew && typeof window.itemsApiNew.updateSparepart === 'function') {
                    const id = keyCandidate; // should be id_sparepart UUID
                    await window.itemsApiNew.updateSparepart(id, payloadNew);
                } else {
                    // fallback to legacy-shaped payload and API
                    const payloadOld = {};
                    if (formData.has('nama_item')) payloadOld.nama_item = formData.get('nama_item');
                    if (formData.has('kode_item')) payloadOld.kode_item = formData.get('kode_item') || null;
                    if (formData.has('jenis_item')) payloadOld.jenis_item = formData.get('jenis_item') || null;
                    if (formData.has('jasa_item')) payloadOld.jasa_item = formData.get('jasa_item') ? Number(formData.get('jasa_item')) : null;
                    if (formData.has('stok_item')) payloadOld.stok_item = formData.get('stok_item') ? Number(formData.get('stok_item')) : 0;
                    if (formData.has('sumber_item')) payloadOld.sumber_item = formData.get('sumber_item') || null;
                    if (formData.has('informasi_tambahan_item')) payloadOld.informasi_tambahan_item = formData.get('informasi_tambahan_item') || null;
                    if (payloadNew.image_url) payloadOld.image_url = payloadNew.image_url;
                    const key = item.kode_item || item.id;
                    await itemsApi.updateItem(key, payloadOld);
                }
                closeModal(modal);
                await loadAndRenderItems();
            } catch (err) {
                console.error('Gagal menyimpan perubahan', err);
                alert('Gagal menyimpan: ' + (err.message || err));
            }
        });

        // show modal
        openModal(modal);
        // focus first input (nama)
        setTimeout(() => {
            const first = modal.querySelector('#edit-nama');
            if (first) first.focus();
        }, 10);
    }

    function openModal(modal) {
        if (!modal) return;
        // prevent background scroll
        document.body.style.overflow = 'hidden';
        // mark global modal-open state so CSS can blur background and raise modal z-index
        try { document.body.classList.add('modal-open'); } catch (e) { /* ignore */ }
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
        // clear global modal-open state and restore scrolling
        try { document.body.classList.remove('modal-open'); } catch (e) { /* ignore */ }
        document.body.style.overflow = '';
    }

    function initItemsUI() {
        // Defensive: ensure header back/master elements are not present on Item page
        try {
            const selectRowInner = document.querySelector('#header-dropdowns .select-row');
            const maybeBack = selectRowInner && selectRowInner.querySelector('.back-btn');
            if (maybeBack && maybeBack.parentNode) maybeBack.parentNode.removeChild(maybeBack);
            const maybeMH = selectRowInner && selectRowInner.querySelector('.master-header');
            if (maybeMH && maybeMH.parentNode) maybeMH.parentNode.removeChild(maybeMH);
        } catch (e) { /* ignore */ }
        if (searchInput) searchInput.addEventListener('input', applyFilters);
        // Ensure panels are direct children of body so position:fixed centers over all content
        try {
            [panelKategori, panelStok, panelJenis].forEach(p => {
                if (!p) return;
                if (p.parentNode !== document.body) document.body.appendChild(p);
                // hide initially
                p.style.display = 'none';
                p.setAttribute('aria-hidden', 'true');
            });
            // ensure shared backdrop / panel registration
            try {
                const fp = window.filterPanels;
                if (fp && typeof fp.ensureBackdrop === 'function') fp.ensureBackdrop();
            } catch (e) { /* ignore */ }
        } catch (e) {
            // ignore if panels not present yet
        }
        // register panels with shared helper so behavior matches Unit's Status panel
        try {
            const fp = window.filterPanels;
            if (fp && typeof fp.register === 'function') {
                if (resetKategori && panelKategori) fp.register(resetKategori, panelKategori);
                if (resetStok && panelStok) fp.register(resetStok, panelStok);
                if (resetJenis && panelJenis) fp.register(resetJenis, panelJenis);
            } else {
                // fallback to previous toggles if filterPanels not available
                if (resetKategori && panelKategori) resetKategori.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(resetKategori, panelKategori); });
                if (resetStok && panelStok) resetStok.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(resetStok, panelStok); });
                if (resetJenis && panelJenis) resetJenis.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(resetJenis, panelJenis); });
                document.addEventListener('click', (ev) => {
                    if (ev.target.closest('.filter-panel') || ev.target.closest('.filter-btn')) return;
                    closeAllPanels();
                });
                document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeAllPanels(); });
            }
        } catch (e) {
            // ignore
        }
        // Reset button: clear search input and restore defaults (kategori & kondisi = all checked)
        const resetBtn = document.querySelector('.reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                if (searchInput) searchInput.value = '';
                // restore kategori & jenis to all-checked defaults
                if (panelKategori) panelKategori.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
                if (panelJenis) panelJenis.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = true);
                // clear stok
                if (panelStok) panelStok.querySelectorAll('input[type="radio"]').forEach(i => i.checked = false);
                applyFilters();
                updateButtonLabelCounts();
                // Ensure the search input is not focused after reset so mobile keyboard does not open.
                // This clears any caret and prevents the keyboard from showing when user taps Reset.
                if (searchInput) searchInput.blur();
                // Also blur the reset button so it doesn't remain focused (avoids persistent focus/blue outline on mobile)
                try { ev.currentTarget && ev.currentTarget.blur && ev.currentTarget.blur(); } catch (e) { /* ignore */ }
            });
        }

        // Wire Add button to open appropriate create modal depending on active section.
        const addBtn = document.querySelector('.add-btn');
        if (addBtn) {
            // remove any previous generic handler to avoid duplicates
            if (addBtn.__itemsHandler) addBtn.removeEventListener('click', addBtn.__itemsHandler);
            const handler = async (ev) => {
                const activeSection = document.querySelector('main section.active');
                const activeId = activeSection ? activeSection.id : null;

                // Only handle Add clicks when we're on the main Item page or Unit page.
                // This prevents the itemsUI from opening the Item modal on other pages
                // (for example 'lainnya' / Jasa) where another module should handle Add.
                if (activeId !== 'item' && activeId !== 'unit') return;

                // From this point we will handle the click (prevent default navigation)
                ev.preventDefault();

                // If we're on the Units page, open unit modal as before
                if (activeId === 'unit') {
                    // Show master page when user clicks "Lihat Master"
                    try {
                        if (window.appMasterUI && typeof window.appMasterUI.renderMasterPage === 'function') {
                            // activate master section in navigation
                            document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
                            const masterBtn = document.querySelector('.bottom-nav button[data-target="master"]');
                            if (masterBtn) masterBtn.classList.add('active');
                            document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
                            const masterSection = document.getElementById('master');
                            if (masterSection) masterSection.classList.add('active');
                            // render master content
                            await window.appMasterUI.renderMasterPage();
                            // ensure header adjusts to master mode (hide stok/status/Lihat Master and show Kembali)
                            try {
                                if (window.appNavigation && typeof window.appNavigation.updateHeaderSearchVisibility === 'function') {
                                    window.appNavigation.updateHeaderSearchVisibility('master');
                                } else if (typeof updateHeaderSearchVisibility === 'function') {
                                    updateHeaderSearchVisibility('master');
                                }
                            } catch (e) { /* ignore */ }
                            return;
                        }
                    } catch (e) { /* fallback to unit modal if master UI unavailable */ }
                    if (window.appUnitsUI && typeof window.appUnitsUI.openCreateUnitModal === 'function') {
                        window.appUnitsUI.openCreateUnitModal();
                        return;
                    }
                }

                // default: items create
                openCreateForm();
            };
            // Navigation controls `.add-btn` centrally; do not override its label here
            addBtn.addEventListener('click', handler);
            addBtn.__itemsHandler = handler;
        }

        // Ensure we don't show the 'Lihat Master' header control on Item page
        try {
            const vm = document.querySelector('#header-dropdowns .select-row .view-master-btn');
            if (vm) vm.style.display = 'none';
        } catch (e) { /* ignore */ }

    }

    // Rebuild filter options when filter mode changes (e.g., navigation switched to Jasa)
    document.addEventListener('filter-mode-changed', () => {
        try {
            fillFilterOptions(allItems);
            // If switched to layanan mode and Jasa page active, trigger jasa list render
            const activeId = document.querySelector('main section.active')?.id;
            if (activeId === 'lainnya' && window.appJasaUI && typeof window.appJasaUI.renderList === 'function') {
                window.appJasaUI.renderList();
            }
        } catch (e) { /* ignore */ }
    });

    // Ensure options are built once on script load if items already loaded
    try { fillFilterOptions(allItems); } catch (e) { /* ignore */ }

    // Open create-item modal (reuses same modal structure)
    function openCreateForm() {
        let modal = document.getElementById('edit-modal');
        if (!modal) {
            // ensure modal exists by calling openEditForm with a dummy (it will create modal)
            // but we can create directly similar to edit modal
            modal = document.createElement('div');
            modal.id = 'edit-modal';
            modal.className = 'modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="modal-backdrop" data-action="close"></div>
                <div class="modal-window" role="dialog" aria-modal="true">
                    <button class="modal-close" aria-label="Tutup">×</button>
                    <div class="modal-content"></div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(modal));
            modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));
        }

        const content = modal.querySelector('.modal-content');
        content.innerHTML = '';

        const form = document.createElement('form');
        form.className = 'edit-form';
        // generate initial kode based on first available jenis (if any)
        const initialJenis = (getUniqueValues('jenis_item').filter(v => String(v || '').trim().toLowerCase() !== 'jasa')[0]) || '';
        const initialKode = generateKodeByJenis(initialJenis);
        form.innerHTML = `
        <div class="modal-header"><h3>Tambah Item Baru</h3></div>
        <div class="form-field inline-row"><label>Kode Item</label><input name="kode_item" id="create-kode" value="${initialKode}" readonly><span class="muted">(Dibuat secara otomatis)</span></div>
                        <label>Nama: <input name="nama_item" id="create-nama" required></label>
                        <label>Kategori: <select name="jenis_item" id="create-jenis"></select></label>
                        <label>Kondisi: <select name="kondisi_item" id="create-kondisi"></select></label>
                        <label>Harga (Rp): <input name="jasa_item" type="number" min="0"></label>
                        <label>Stok: <input name="stok_item" type="number" min="0" value="0"></label>
                        <label>Sumber: <input name="sumber_item" ></label>
                        <label>Informasi Tambahan: <textarea name="informasi_tambahan_item"></textarea></label>
                        <label>Gambar: <input name="image_file" type="file" accept="image/jpeg,image/png,image/webp"></label>
                        <div class="modal-actions edit-actions">
                            <button class="btn btn-secondary cancel-edit" type="button">Batal</button>
                            <button class="btn btn-primary save-edit" type="submit">Simpan</button>
                        </div>
                `;

        content.appendChild(form);

        // populate kategori & kondisi selects for create
        // Exclude 'Jasa' from the create-item kategori options because Jasa
        // are managed on their own page (lainnya). Also exclude 'Digital' from kondisi.
        const jenisValues = getUniqueValues('jenis_item').filter(v => String(v || '').trim().toLowerCase() !== 'jasa');
        const kondisiValues = getUniqueValues('kondisi_item').filter(v => String(v || '').trim().toLowerCase() !== 'digital');
        populateSelectOptions(form.querySelector('#create-jenis'), jenisValues);
        populateSelectOptions(form.querySelector('#create-kondisi'), kondisiValues);

        // update kode when kategori (jenis) changes so user sees the generated kode
        try {
            const jenisSelect = form.querySelector('#create-jenis');
            const kodeInput = form.querySelector('#create-kode');
            if (jenisSelect && kodeInput) {
                jenisSelect.addEventListener('change', (ev) => {
                    try {
                        const newKode = generateKodeByJenis(jenisSelect.value || '');
                        kodeInput.value = newKode;
                    } catch (e) { /* ignore */ }
                });
            }
        } catch (e) { /* ignore */ }

        // preview handling for create form
        const previewElC = form.querySelector('.image-preview');
        const imgInputC = form.querySelector('input[name="image_file"]');
        if (imgInputC) {
            imgInputC.addEventListener('change', (ev) => {
                const f = imgInputC.files && imgInputC.files[0];
                if (f) {
                    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
                    if (!allowed.includes(f.type)) {
                        alert('Jenis file tidak didukung. Gunakan JPG, PNG, atau WebP.');
                        imgInputC.value = '';
                        previewElC.innerHTML = '';
                        previewElC.setAttribute('aria-hidden', 'true');
                        return;
                    }
                    const maxBytes = 4 * 1024 * 1024; // 4MB
                    if (f.size > maxBytes) {
                        alert('Ukuran file terlalu besar. Maksimal 4 MB.');
                        imgInputC.value = '';
                        previewElC.innerHTML = '';
                        previewElC.setAttribute('aria-hidden', 'true');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        previewElC.innerHTML = `<img src="${reader.result}" alt="Preview" />`;
                        previewElC.setAttribute('aria-hidden', 'false');
                    };
                    reader.readAsDataURL(f);
                } else {
                    previewElC.innerHTML = '';
                    previewElC.setAttribute('aria-hidden', 'true');
                }
            });
        }

        form.querySelector('.cancel-edit').addEventListener('click', (ev) => { ev.preventDefault(); closeModal(modal); });

        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const btnSave = form.querySelector('.save-edit');
            try {
                // basic client-side validation
                const fd = new FormData(form);
                const payloadNew = {};
                if (fd.has('nama_item')) payloadNew.nama_sparepart = fd.get('nama_item');
                if (fd.has('kode_item')) payloadNew.kode_sparepart = fd.get('kode_item') || null;
                if (fd.has('jenis_item')) payloadNew.kategori = fd.get('jenis_item');
                if (fd.has('jasa_item')) payloadNew.harga_jual = fd.get('jasa_item') ? Number(fd.get('jasa_item')) : null;
                if (fd.has('stok_item')) payloadNew.stok = fd.get('stok_item') ? Number(fd.get('stok_item')) : 0;
                // upload image file if provided
                const fileInput = form.querySelector('input[name="image_file"]');
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    const uploaded = await uploadImageFile(fileInput.files[0]);
                    if (uploaded) payloadNew.image_url = uploaded;
                }

                // disable save button
                if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Menyimpan...'; }

                // ensure kode_sparepart present — generate based on jenis if empty
                if (!payloadNew.kode_sparepart) payloadNew.kode_sparepart = generateKodeByJenis(payloadNew.kategori || '');
                // prefer new API when present
                let created;
                if (window.itemsApiNew && typeof window.itemsApiNew.createSparepart === 'function') {
                    created = await window.itemsApiNew.createSparepart(payloadNew);
                } else {
                    // fallback to legacy payload and API
                    const payloadOld = {};
                    if (fd.has('nama_item')) payloadOld.nama_item = fd.get('nama_item');
                    if (fd.has('kode_item')) payloadOld.kode_item = fd.get('kode_item') || null;
                    if (fd.has('jenis_item')) payloadOld.jenis_item = fd.get('jenis_item');
                    if (fd.has('jasa_item')) payloadOld.jasa_item = fd.get('jasa_item') ? Number(fd.get('jasa_item')) : null;
                    if (fd.has('stok_item')) payloadOld.stok_item = fd.get('stok_item') ? Number(fd.get('stok_item')) : 0;
                    if (payloadNew.image_url) payloadOld.image_url = payloadNew.image_url;
                    if (!payloadOld.kode_item) payloadOld.kode_item = generateKodeByJenis(payloadOld.jenis_item || '');
                    created = await itemsApi.addItem(payloadOld);
                }
                closeModal(modal);
                await loadAndRenderItems();
            } catch (err) {
                console.error('Gagal menambah item', err);
                alert('Gagal menambah item: ' + (err.message || err));
            } finally {
                if (form.querySelector('.save-edit')) { form.querySelector('.save-edit').disabled = false; form.querySelector('.save-edit').textContent = 'Simpan'; }
            }
        });

        openModal(modal);
        setTimeout(() => { const first = modal.querySelector('#create-nama'); if (first) first.focus(); }, 10);
    }

    window.appItemsUI = { loadAndRenderItems, initItemsUI, applyFilters, renderItems };
})();
