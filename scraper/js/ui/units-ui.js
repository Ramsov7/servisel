/* units-ui.js — kebab-case copy of unitsUI.js (logic unchanged) */

(function () {
    const container = document.getElementById('unit');

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isLikelyUUID(val) {
        if (!val || typeof val !== 'string') return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    }

    function guessBrand(nama) {
        if (!nama || typeof nama !== 'string') return null;
        const cleaned = nama.replace(/[\(\)\[\]\-_\/]/g, ' ').trim();
        const tokens = cleaned.split(/\s+/).filter(Boolean);
        if (!tokens.length) return null;
        const candidate = tokens[0];
        if (/^\d+$/.test(candidate)) return null;
        return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
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
            img.addEventListener('error', function () {
                this.onerror = null;
                this.src = 'assets/logos/servisel.png';
            });
            imgWrap.appendChild(img);
        } catch (e) { /* ignore */ }
    }

    function getSafeSup() {
        try {
            return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        } catch (e) {
            return window.supabase || null;
        }
    }

    // Upload helper for unit images — uploads to Supabase Storage bucket 'unit-foto'
    async function uploadUnitImage(file, unitId) {
        if (!file) return null;
        const sup = getSafeSup();
        if (!sup || !sup.storage) return null;
        const bucket = 'unit-foto';
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `${Date.now()}_${safeName}`;
        const path = `units/${unitId || 'unknown'}/${filename}`;
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

    async function tableExistsSafe(table, sup) {
        try {
            if (typeof window.tableExists === 'function') return await window.tableExists(table, sup);
        } catch (e) { /* ignore and fall through */ }
        return false;
    }

    async function renderList() {
        if (!container) return;
        try {
            const sup = getSafeSup();
            if (!sup) throw new Error('Supabase client belum siap (unitsUI.renderList)');

            const safeSelect = async (t, cols = '*', limitN = 500) => {
                try {
                    const exists = await tableExistsSafe(t, sup);
                    if (!exists) return { error: new Error('Table not found'), data: [] };
                    const q = sup.from(t).select(cols);
                    if (limitN) q.limit(limitN);
                    return await q;
                } catch (e) {
                    return { error: e, data: [] };
                }
            };

            let masterUnits = null;
            let katalogUnits = null;
            try {
                const probeMaster = await safeSelect('master_unit', 'id_master,nama_brand,nama_model,gambar_master,spesifikasi', 500);
                if (!probeMaster.error && probeMaster.data && probeMaster.data.length) {
                    masterUnits = probeMaster.data;
                }
            } catch (e) { /* ignore - master_unit may not exist */ }
            try {
                // New katalog table may contain katalog.gambar_url as canonical catalogue images
                const probeKatalog = await safeSelect('katalog', 'id_katalog,nama_brand,nama_model,gambar_url,spesifikasi', 500);
                if (!probeKatalog.error && probeKatalog.data && probeKatalog.data.length) katalogUnits = probeKatalog.data;
            } catch (e) { /* ignore - katalog may not exist */ }

            const tableCandidates = ['unit', 'master_unit'];
            let data = null;
            let chosenTable = null;
            let lastError = null;
            for (const t of tableCandidates) {
                try {
                    const res = await safeSelect(t, '*', 500);
                    if (res.error) throw res.error;
                    data = res.data || [];
                    if (Array.isArray(data) && data.length && Object.prototype.hasOwnProperty.call(data[0], 'kode_unit')) {
                        data.sort((a, b) => {
                            const aa = (a.kode_unit || '').toString().toLowerCase();
                            const bb = (b.kode_unit || '').toString().toLowerCase();
                            return aa.localeCompare(bb, undefined, { numeric: true });
                        });
                    }
                    chosenTable = t;
                } catch (errFetch) {
                    lastError = errFetch;
                    continue;
                }
                if (chosenTable) {
                    if (container) container.dataset.unitsTable = chosenTable;
                    break;
                }
            }
            if (data === null) throw lastError || new Error('Tidak dapat menemukan tabel units pada database');

            const card = container.querySelector('.card');
            if (!card) return;
            const existing = card.querySelector('.card-body');
            if (existing) existing.remove();

            const cb = document.createElement('div');
            cb.className = 'card-body';
            const listWrap = document.createElement('div');
            listWrap.className = 'list-wrap';

            const modelsGrid = document.createElement('div');
            modelsGrid.className = 'models-grid items-grid';
            const brands = {};
            if (masterUnits && masterUnits.length) {
                try {
                    const idMasters = masterUnits.map(m => m.id_master).filter(Boolean);
                    const counts = {};
                    if (idMasters.length) {
                        try {
                            const { data: unitsRows } = await sup.from('unit').select('id_master,status').in('id_master', idMasters).limit(2000);
                            if (unitsRows && unitsRows.length) {
                                unitsRows.forEach(r => {
                                    const inStock = !r.status || r.status.toString().toLowerCase() === 'aktif' || r.status.toString().toLowerCase() === 'tersedia';
                                    if (inStock && r.id_master) counts[r.id_master] = (counts[r.id_master] || 0) + 1;
                                });
                            }
                        } catch (e) {
                            // ignore count errors and leave counts empty
                        }
                    }

                    const availableModels = (masterUnits || []).filter(m => {
                        const cnt = counts[m.id_master] || 0;
                        return cnt > 0;
                    });

                    if ((availableModels || []).length) {
                        availableModels.forEach(m => {
                            const mcard = document.createElement('div');
                            mcard.className = 'item-card compact modern model-card';
                            const title = escapeHtml(m.nama_model || m.kode_model || m.nama_unit || 'Tanpa Nama');
                            const stockNum = counts[m.id_master] || 0;
                            mcard.innerHTML = `
                                <div class="card-main">
                                    <div class="img-wrap"></div>
                                    <div class="card-meta">
                                        <div class="card-title">${title}</div>
                                        <div class="card-stock">Stok: <span class="stock-value">${stockNum}</span></div>
                                    </div>
                                </div>
                            `;
                            try { insertBrandLogo(mcard.querySelector('.img-wrap'), m.nama_brand || m.brand || ''); } catch (e) { }
                            modelsGrid.appendChild(mcard);
                        });
                    }

                    try {
                        const { data: unlinkedUnits } = await sup.from('unit').select('*').is('id_master', null).eq('status', 'aktif').limit(200);
                        if (unlinkedUnits && unlinkedUnits.length) {
                            unlinkedUnits.forEach(u => {
                                const cardEl = document.createElement('div');
                                cardEl.className = 'item-card compact modern unit-card';
                                const displayName = u.nama_unit || u.nama_model || u.kode_unit || 'Tanpa Nama';
                                const stockNum = 1;
                                cardEl.innerHTML = `
                                    <div class="card-main">
                                        <div class="img-wrap"></div>
                                        <div class="card-meta">
                                            <div class="card-title">${escapeHtml(displayName)}</div>
                                            <div class="card-stock">Stok: <span class="stock-value">${stockNum}</span></div>
                                        </div>
                                    </div>
                                `;
                                const imgWrap = cardEl.querySelector('.img-wrap');
                                try { insertBrandLogo(imgWrap, u.nama_brand || guessBrand(u.nama_unit) || ''); } catch (e) { }
                                if (imgWrap) {
                                    const ph = document.createElement('div');
                                    ph.className = 'card-thumb placeholder';
                                    ph.textContent = 'Tidak Ada Gambar';
                                    imgWrap.appendChild(ph);
                                }
                                modelsGrid.appendChild(cardEl);
                            });
                        }
                    } catch (e) { /* ignore unlinked fetch errors */ }

                    if (!modelsGrid.querySelector('.item-card')) {
                        const empty = document.createElement('div');
                        empty.className = 'empty-state empty-centered';
                        empty.innerHTML = `<p>Tidak ada tipe dengan stok tersedia.</p>`;
                        modelsGrid.appendChild(empty);
                    }

                    cb.appendChild(modelsGrid);
                    card.appendChild(cb);
                    return;
                } catch (e) {
                    const empty = document.createElement('div');
                    empty.className = 'empty-state empty-centered';
                    empty.innerHTML = `<p>Tidak ada tipe dengan stok tersedia.</p>`;
                    modelsGrid.appendChild(empty);
                    cb.appendChild(modelsGrid);
                    card.appendChild(cb);
                    return;
                }
            }

            const panelStatus = document.getElementById('panel-status');
            try {
                if (panelStatus) statusValues = Array.from(panelStatus.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value).filter(Boolean);
            } catch (e) { statusValues = []; }

            if (!data || data.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty-state empty-centered';
                empty.innerHTML = `<p>Belum ada Unit.</p>`;
                listWrap.appendChild(empty);
            } else {
                const headerPanelStok = document.getElementById('panel-stok');
                let stokValue = '';
                try { stokValue = headerPanelStok && headerPanelStok.querySelector('input[type="radio"]:checked') ? headerPanelStok.querySelector('input[type="radio"]:checked').value : ''; } catch (e) { stokValue = ''; }

                const filteredByStatus = (statusValues && statusValues.length) ? data.filter(u => statusValues.includes((u.status || '').toString())) : data;

                const filtered = (filteredByStatus || []).filter(u => {
                    const kategori = (u.kategori || u.kategori_unit || u.nama_kategori || u.nama_unit || '')?.toString?.() || '';
                    if (!kategori.toLowerCase().includes('ponsel')) return false;
                    const stockNum = Number(u.stok ?? u.stok_item ?? u.stock ?? 0);
                    const effectiveStok = stokValue || 'tersedia';
                    if (effectiveStok === 'habis') return stockNum === 0;
                    if (effectiveStok === 'tersedia') return stockNum > 0;
                    return true;
                });
                // Batch-fetch uploaded photos (unit_foto) to prefer user-uploaded images
                let unitFotoMap = {};
                try {
                    const unitIds = (filtered || []).map(u => u.id_unit || u.id || null).filter(Boolean);
                    if (unitIds && unitIds.length) {
                        const { data: fotos, error: fotosErr } = await sup.from('unit_foto').select('id_unit,file_url,jenis,urutan').in('id_unit', unitIds).limit(1000);
                        if (!fotosErr && fotos && fotos.length) {
                            fotos.forEach(f => {
                                if (!f || !f.id_unit) return;
                                unitFotoMap[f.id_unit] = unitFotoMap[f.id_unit] || [];
                                unitFotoMap[f.id_unit].push(f.file_url);
                            });
                        }
                    }
                } catch (e) {
                    unitFotoMap = {};
                }
                const unitGrid = document.createElement('div');
                unitGrid.className = 'models-grid items-grid';

                filtered.forEach(u => {
                    const cardEl = document.createElement('div');
                    cardEl.className = 'item-card compact modern unit-card';
                    cardEl.dataset.unitId = u.id_unit || u.id || u.kode_unit || '';

                    const displayName = u.nama_unit || (u.nama_brand && u.nama_model ? (u.nama_brand + ' ' + u.nama_model) : (u.nama_model || u.nama_brand)) || u.kode_unit || 'Tanpa Nama';
                    const stockNum = Number(u.stok ?? u.stok_item ?? u.stock ?? 0);
                    const kategori = u.kategori || u.kategori_unit || u.jenis || '';
                    const kondisi = u.kondisi || u.kondisi_unit || u.kondisi_item || '';
                    const harga = u.harga_beli_unit ?? u.harga_beli ?? u.harga ?? null;

                    cardEl.innerHTML = `
                        <div class="card-main">
                            <div class="img-wrap"></div>
                            <div class="card-meta">
                                <div class="card-title">${escapeHtml(displayName)}</div>
                                <div class="card-stock">Stok: <span class="stock-value">${(stockNum ?? '-')}</span></div>
                            </div>
                        </div>
                        <div class="card-details" aria-hidden="true">
                            <div class="details-body">
                                <p><strong>Kode:</strong> ${escapeHtml(u.kode_unit || u.kode_model || '-')}</p>
                                <p><strong>Kategori:</strong> ${escapeHtml(kategori || '-')}</p>
                                <p><strong>Kondisi:</strong> ${escapeHtml(kondisi || '-')}</p>
                                <p><strong>Harga Beli:</strong> ${harga ? 'Rp ' + Number(harga).toLocaleString() : '-'}</p>
                            </div>
                        </div>
                    `;

                    const imgWrap = cardEl.querySelector('.img-wrap');
                    if (imgWrap) {
                        let bname = u.nama_brand || guessBrand(u.nama_unit) || '';
                        try { insertBrandLogo(imgWrap, bname); } catch (e) { }
                        const spinner = document.createElement('div');
                        spinner.className = 'img-spinner';
                        imgWrap.appendChild(spinner);
                        // Prefer uploaded images from unit_foto, then foto_sesudah/foto_sebelum,
                        // then existing image_url/foto fields, then katalog/master defaults.
                        let imgSrc = '';
                        try {
                            const uid = u.id_unit || u.id || null;
                            if (uid && unitFotoMap && unitFotoMap[uid] && unitFotoMap[uid].length) {
                                imgSrc = (unitFotoMap[uid][0] || '').toString().trim();
                            }
                            if (!imgSrc) imgSrc = (u.foto_sesudah || u.foto_sebelum || u.foto || u.image_url || '').toString().trim();
                            if (!imgSrc) {
                                const kid = u.id_katalog || u.id_master || null;
                                if (kid) {
                                    if (katalogUnits && katalogUnits.length) {
                                        const k = katalogUnits.find(x => (x.id_katalog || '').toString() === (kid || '').toString());
                                        if (k && k.gambar_url) imgSrc = (k.gambar_url || '').toString().trim();
                                    }
                                    if (!imgSrc && masterUnits && masterUnits.length) {
                                        const m = masterUnits.find(x => (x.id_master || '').toString() === (kid || '').toString());
                                        if (m && m.gambar_master) imgSrc = (m.gambar_master || '').toString().trim();
                                    }
                                }
                            }
                        } catch (e) {
                            imgSrc = (u.image_url || u.foto || '').toString().trim();
                        }

                        if (imgSrc) {
                            const img = document.createElement('img');
                            img.className = 'card-thumb';
                            img.loading = 'lazy';
                            img.alt = displayName || 'Unit';
                            img.addEventListener('load', () => {
                                if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                                imgWrap.appendChild(img);
                            });
                            img.addEventListener('error', () => {
                                if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                                const ph = document.createElement('div');
                                ph.className = 'card-thumb placeholder';
                                ph.textContent = 'Tidak Ada Gambar';
                                imgWrap.appendChild(ph);
                            });
                            img.src = imgSrc;
                        } else {
                            if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
                            const ph = document.createElement('div');
                            ph.className = 'card-thumb placeholder';
                            ph.textContent = 'Tidak Ada Gambar';
                            imgWrap.appendChild(ph);
                        }
                    }

                    cardEl.addEventListener('click', (ev) => {
                        if (ev.target.closest('.btn') || ev.target.closest('button')) return;
                        const isOpen = cardEl.classList.toggle('expanded');
                        const details = cardEl.querySelector('.card-details');
                        if (details) details.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
                        if (!isOpen) {
                            cardEl.style.transform = '';
                            cardEl.style.boxShadow = '';
                            void cardEl.offsetHeight;
                            if (!cardEl.getAttribute('style')) cardEl.removeAttribute('style');
                        }
                    });

                    cardEl.addEventListener('touchend', (ev) => {
                        setTimeout(() => {
                            if (!cardEl.classList.contains('expanded')) {
                                cardEl.style.transform = '';
                                cardEl.style.boxShadow = '';
                                void cardEl.offsetHeight;
                                if (!cardEl.getAttribute('style')) cardEl.removeAttribute('style');
                            }
                        }, 50);
                    }, { passive: true });

                    // Add an upload button so users can upload images for this unit
                    try {
                        const unitId = cardEl.dataset.unitId || null;
                        const actions = cardEl.querySelector('.details-body');
                        if (actions) {
                            const uploadLabel = document.createElement('label');
                            uploadLabel.style.display = 'block';
                            uploadLabel.style.marginTop = '8px';
                            uploadLabel.innerHTML = `Upload Gambar: `;
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.accept = 'image/jpeg,image/png,image/webp';
                            fileInput.style.display = 'inline-block';
                            uploadLabel.appendChild(fileInput);
                            actions.appendChild(uploadLabel);
                            fileInput.addEventListener('change', async (ev) => {
                                const f = fileInput.files && fileInput.files[0];
                                if (!f) return;
                                try {
                                    const sup = getSafeSup(); if (!sup) throw new Error('Supabase client belum siap');
                                    const publicUrl = await uploadUnitImage(f, unitId);
                                    if (!publicUrl) throw new Error('Upload gagal');
                                    // Insert into unit_foto table so the renderer can pick it up
                                    try {
                                        const insertObj = { id_unit: unitId, file_url: publicUrl, jenis: 'lainnya', urutan: 0 };
                                        await sup.from('unit_foto').insert([insertObj]);
                                    } catch (e) {
                                        console.warn('Gagal menyimpan record unit_foto, tetap akan mencoba menampilkan gambar', e);
                                    }
                                    // Re-render list to show uploaded image
                                    await renderList();
                                } catch (e) {
                                    console.error('Gagal upload gambar unit', e);
                                    alert('Gagal upload gambar: ' + (e && e.message ? e.message : String(e)));
                                }
                            });
                        }
                    } catch (e) { /* ignore upload UI errors */ }
                    unitGrid.appendChild(cardEl);
                });

                listWrap.appendChild(unitGrid);
            }

            cb.appendChild(listWrap);
            card.appendChild(cb);
        } catch (e) {
            console.error('Gagal memuat daftar unit', e);
        }
    }

    async function insertUnit(payload) {
        const sup = getSafeSup();
        if (!sup) throw new Error('Supabase client belum siap (unitsUI.insertUnit)');

        const safeSelect = async (t, cols = '*', limitN = 1) => {
            try {
                const exists = await tableExistsSafe(t, sup);
                if (!exists) return { error: new Error('Table not found'), data: [] };
                const q = sup.from(t).select(cols);
                if (limitN) q.limit(limitN);
                return await q;
            } catch (e) { return { error: e, data: [] }; }
        };

        const candidateOrder = container && container.dataset && container.dataset.unitsTable ? [container.dataset.unitsTable, 'unit', 'master_unit'] : ['unit', 'master_unit'];
        const insertCandidates = candidateOrder.filter(t => t !== 'master_unit');
        let resolvedTable = null;
        let lastErr = null;
        let sampleRow = null;
        for (const t of insertCandidates.concat(candidateOrder)) {
            try {
                const res = await safeSelect(t, '*', 1);
                if (res && !res.error) {
                    const probe = res;
                    const sample = (probe.data && probe.data.length) ? probe.data[0] : null;
                    let cols = sample ? Object.keys(sample) : [];
                    const fieldCandidates = {
                        kode_unit: ['kode_unit', 'kode_model', 'id_master', 'id_unit'],
                        nama_unit: ['nama_unit', 'nama_model', 'nama_brand', 'name'],
                        harga_beli_unit: ['harga_beli_unit', 'harga_beli', 'harga_beli_unit'],
                        tanggal_masuk: ['tanggal_masuk', 'created_at', 'last_synced']
                    };
                    if ((!cols || cols.length === 0)) {
                        const guessed = new Set();
                        const allCandidates = Array.from(new Set([].concat(...Object.values(fieldCandidates))));
                        for (const c of allCandidates) {
                            try {
                                const existsCol = await tableExistsSafe(t, sup);
                                if (!existsCol) continue;
                                const probeCol = await sup.from(t).select(c).limit(1);
                                if (probeCol && !probeCol.error) guessed.add(c);
                            } catch (e) { /* ignore */ }
                        }
                        cols = Array.from(guessed);
                    }
                    if (cols && cols.length) {
                        resolvedTable = t;
                        sampleRow = sample;
                        if (container) container.dataset.unitsTable = t;
                        availableCols = cols;
                        break;
                    }
                }
            } catch (e) { lastErr = e; continue; }
        }
        if (!resolvedTable) throw lastErr || new Error('Tidak dapat menemukan tabel unit pada database');

        let availableCols = sampleRow ? Object.keys(sampleRow) : [];
        const fieldCandidates = {
            kode_unit: ['kode_unit', 'kode_model', 'id_master', 'id_unit'],
            nama_unit: ['nama_unit', 'nama_model', 'nama_brand', 'name'],
            harga_beli_unit: ['harga_beli_unit', 'harga_beli', 'harga_beli_unit'],
            tanggal_masuk: ['tanggal_masuk', 'created_at', 'last_synced']
        };
        if ((!availableCols || availableCols.length === 0) && resolvedTable) {
            const guessed = new Set();
            const allCandidates = Array.from(new Set([].concat(...Object.values(fieldCandidates))));
            for (const c of allCandidates) {
                try {
                    const existsCol = await tableExistsSafe(resolvedTable, sup);
                    if (!existsCol) continue;
                    const probeCol = await sup.from(resolvedTable).select(c).limit(1);
                    if (probeCol && !probeCol.error) {
                        guessed.add(c);
                    }
                } catch (e) {
                }
            }
            availableCols = Array.from(guessed);
        }
        const sanitized = {};
        Object.keys(fieldCandidates).forEach(formKey => {
            const candidates = fieldCandidates[formKey];
            for (const c of candidates) {
                if (availableCols.includes(c)) {
                    if (c.startsWith('id_') && !isLikelyUUID(payload[formKey])) {
                        continue;
                    }
                    const val = payload[formKey];
                    sanitized[c] = val === undefined ? null : val;
                    break;
                }
            }
        });
        let insertObj = null;
        if (Object.keys(sanitized).length > 0) {
            insertObj = sanitized;
        } else {
            const copy = Object.assign({}, payload);
            delete copy.harga_beli_unit;
            delete copy.harga_beli;
            insertObj = copy;
        }
        try {
            if (resolvedTable && (resolvedTable === 'master_unit' || (availableCols && availableCols.includes('nama_brand')))) {
                if (!insertObj.nama_brand || insertObj.nama_brand === null) {
                    insertObj.nama_brand = guessBrand(payload.nama_unit) || 'Unknown';
                }
            }
        } catch (e) { }
        try {
            if (resolvedTable === 'unit' && (!insertObj.id_master || insertObj.id_master === null)) {
                const tryName = insertObj.nama_unit || payload.nama_unit || '';
                const tryCode = insertObj.kode_unit || payload.kode_unit || '';
                if (tryName || tryCode) {
                    try {
                        let q = sup.from('master_unit').select('id_master,nama_model,nama_brand').limit(5);
                        if (tryCode) q = q.or(`kode_model.eq.${tryCode},kode_model.ilike.%${tryCode}%`);
                        else if (tryName) q = q.or(`nama_model.eq.${tryName},nama_model.ilike.%${tryName}%`);
                        const probe = await q;
                        if (probe && !probe.error && probe.data && probe.data.length) {
                            const cand = probe.data[0];
                            if (cand && cand.id_master) insertObj.id_master = cand.id_master;
                        }
                    } catch (e) { }
                }
            }
        } catch (e) { }

        const res = await sup.from(resolvedTable).insert([insertObj]).select();
        if (res.error) throw res.error;
        try {
            if (resolvedTable === 'unit' && (!insertObj.id_master || insertObj.id_master === null)) {
                const created = res.data && res.data.length ? res.data[0] : null;
                const idField = created ? (created.id_unit ? 'id_unit' : (created.id ? 'id' : Object.keys(created)[0])) : null;
                const tryName = insertObj.nama_unit || payload.nama_unit || '';
                const tryCode = insertObj.kode_unit || payload.kode_unit || '';
                if (idField && created && (tryName || tryCode)) {
                    try {
                        let q = sup.from('master_unit').select('id_master,nama_model,nama_brand').limit(5);
                        if (tryCode) q = q.or(`kode_model.eq.${tryCode},kode_model.ilike.%${tryCode}%`);
                        else if (tryName) q = q.or(`nama_model.eq.${tryName},nama_model.ilike.%${tryName}%`);
                        const probe = await q;
                        if (probe && !probe.error && probe.data && probe.data.length) {
                            const cand = probe.data[0];
                            if (cand && cand.id_master) {
                                const upd = {};
                                upd['id_master'] = cand.id_master;
                                try {
                                    await sup.from(resolvedTable).update(upd).eq(idField, created[idField]);
                                    created.id_master = cand.id_master;
                                    console.debug('unitsUI.insertUnit: linked inserted unit to master_unit', cand.id_master, created[idField]);
                                } catch (e) { }
                            }
                        }
                    } catch (e) { }
                }
            }
        } catch (e) { }

        return res.data;
    }

    function closeModalByEl(el) {
        if (!el) return;
        el.setAttribute('aria-hidden', 'true');
        try { document.body.classList.remove('modal-open'); } catch (e) { }
        if (el.parentNode) el.parentNode.removeChild(el);
    }

    function generateKodeUnit() {
        const t = Date.now().toString(36).toUpperCase();
        const r = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `UD-${t}-${r}`;
    }

    function createSimpleModal(title, innerHTML, onSubmit) {
        const modal = document.createElement('div');
        modal.className = 'simple-modal modal';
        modal.setAttribute('aria-hidden', 'false');
        modal.innerHTML = `
            <div class="modal-backdrop" data-action="close"></div>
            <div class="modal-window">
                <div class="modal-header"><h3>${title}</h3><button class="modal-close" aria-label="Tutup">×</button></div>
                <form class="modal-form"><div class="modal-body">${innerHTML}</div><div class="modal-actions"><button type="button" class="btn btn-secondary cancel">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div></form>
            </div>
        `;
        document.body.appendChild(modal);
        try { document.body.classList.add('modal-open'); } catch (e) { }
        modal.querySelector('.modal-backdrop').addEventListener('click', () => closeModalByEl(modal));
        modal.querySelector('.modal-close').addEventListener('click', () => closeModalByEl(modal));
        modal.querySelector('.cancel').addEventListener('click', () => closeModalByEl(modal));
        const form = modal.querySelector('form');
        form.addEventListener('submit', (ev) => { ev.preventDefault(); if (typeof onSubmit === 'function') onSubmit(form); });
        return modal;
    }

    async function generateNextKodeUnit(kategori, kondisi) {
        const sup = getSafeSup();
        const prefMap = {
            'ponsel': { 'baru': 'HPN', 'bekas': 'HPS' },
            'laptop': { 'baru': 'LPN', 'bekas': 'LPS' }
        };
        const k = (String(kategori || '').trim().toLowerCase());
        const kond = (String(kondisi || '').trim().toLowerCase());
        const pref = (prefMap[k] && prefMap[k][kond]) ? prefMap[k][kond] : 'UN';
        let existing = [];
        try {
            if (!sup) throw new Error('Supabase client belum siap');
            const tableCandidates = container && container.dataset && container.dataset.unitsTable ? [container.dataset.unitsTable, 'unit', 'master_unit'] : ['unit', 'master_unit'];
            let lastErr = null;
            for (const t of tableCandidates) {
                try {
                    const exists = await tableExistsSafe(t, sup);
                    if (!exists) { lastErr = new Error('Table ' + t + ' not found'); continue; }
                    const { data, error } = await sup.from(t).select('*').limit(2000);
                    if (error) throw error;
                    const rows = data || [];
                    existing = (rows || []).map(r => ({ kode_unit: r.kode_unit || r.kode_model || r.id_master || '' }));
                    if (container) container.dataset.unitsTable = t;
                    break;
                } catch (e) {
                    lastErr = e;
                }
            }
            if (!existing.length && lastErr) {
            }
        } catch (e) { existing = []; }

        let max = 0;
        const re = new RegExp('^' + pref + '(0*)(\\d+)$', 'i');
        (existing || []).forEach(u => {
            const code = (u.kode_unit || '').toString();
            const m = code.match(re);
            if (m && m[2]) {
                const num = parseInt(m[2], 10);
                if (!isNaN(num) && num > max) max = num;
            }
        });
        const next = max + 1;
        const suffix = String(next).padStart(4, '0');
        return `${pref}${suffix}`;
    }

    function openCreateUnitModal() {
        const defaultKategori = 'Ponsel';
        const defaultKondisi = 'Baru';
        const defaultKode = 'HPN0001';
        const modal = createSimpleModal('Tambah Unit Baru', `
            <div class="form-grid">
                <div class="form-field inline-row"><label>Kode Unit</label><input name="kode_unit" id="create-kode-unit" value="${defaultKode}" readonly required><span class="muted">(Dibuat secara otomatis)</span></div>
                <div class="form-field"><label>Nama Unit <input name="nama_unit"></label></div>
                <div class="form-field"><label>Kategori <select name="kategori_unit" id="create-kategori-unit"><option value="Ponsel">Ponsel</option><option value="Laptop">Laptop</option></select></label></div>
                <div class="form-field"><label>Kondisi <select name="kondisi_unit" id="create-kondisi-unit"><option value="Baru">Baru</option><option value="Bekas">Bekas</option></select></label></div>
                <div class="form-field"><label>Harga Beli (opsional) <input name="harga_beli_unit" type="number" min="0"></label></div>
            </div>
        `, async (form) => {
            const fd = new FormData(form);
            const payload = {
                kode_unit: fd.get('kode_unit'),
                nama_unit: fd.get('nama_unit') || null,
                harga_beli_unit: fd.get('harga_beli_unit') ? Number(fd.get('harga_beli_unit')) : null,
                tanggal_masuk: new Date().toISOString().slice(0, 10)
            };
            try {
                const sup = getSafeSup();
                if (!sup) throw new Error('Supabase client belum siap (unitsUI.openCreateUnitModal)');
                const candidateOrder = container && container.dataset && container.dataset.unitsTable ? [container.dataset.unitsTable, 'unit', 'master_unit', 'units'] : ['unit', 'master_unit', 'units'];
                let resolvedTable = null;
                let lastErr = null;
                let sampleRow = null;
                const safeSelect = async (t, cols = '*', limitN = 1) => {
                    try {
                        const exists = await tableExistsSafe(t, sup);
                        if (!exists) return { error: new Error('Table not found'), data: [] };
                        const q = sup.from(t).select(cols);
                        if (limitN) q.limit(limitN);
                        return await q;
                    } catch (e) { return { error: e, data: [] }; }
                };
                for (const t of candidateOrder) {
                    try {
                        const probe = await safeSelect(t, '*', 1);
                        if (probe && !probe.error) {
                            resolvedTable = t;
                            sampleRow = (probe.data && probe.data.length) ? probe.data[0] : null;
                            if (container) container.dataset.unitsTable = t;
                            break;
                        }
                    } catch (e) {
                        lastErr = e;
                        continue;
                    }
                }
                if (!resolvedTable) {
                    const err = lastErr || new Error('Tidak dapat menemukan tabel unit pada database (coba refresh dan periksa schema)');
                    throw err;
                }

                let availableCols = sampleRow ? Object.keys(sampleRow) : [];
                const fieldCandidates = {
                    kode_unit: ['kode_unit', 'kode_model', 'id_master', 'id_unit'],
                    nama_unit: ['nama_unit', 'nama_model', 'nama_brand', 'name'],
                    harga_beli_unit: ['harga_beli_unit', 'harga_beli', 'harga_beli_unit'],
                    tanggal_masuk: ['tanggal_masuk', 'created_at', 'last_synced']
                };
                if ((!availableCols || availableCols.length === 0) && resolvedTable) {
                    const guessed = new Set();
                    const allCandidates = Array.from(new Set([].concat(...Object.values(fieldCandidates))));
                    for (const c of allCandidates) {
                        try {
                            const probeCol = await sup.from(resolvedTable).select(c).limit(1);
                            if (probeCol && !probeCol.error) guessed.add(c);
                        } catch (e) {
                        }
                    }
                    availableCols = Array.from(guessed);
                }
                const sanitized = {};
                Object.keys(fieldCandidates).forEach(formKey => {
                    const candidates = fieldCandidates[formKey];
                    for (const c of candidates) {
                        if (availableCols.includes(c)) {
                            if (c.startsWith('id_') && !isLikelyUUID(payload[formKey])) {
                                continue;
                            }
                            const val = payload[formKey];
                            sanitized[c] = val === undefined ? null : val;
                            break;
                        }
                    }
                });

                let insertObj = null;
                if (Object.keys(sanitized).length > 0) {
                    insertObj = sanitized;
                } else {
                    const copy = Object.assign({}, payload);
                    delete copy.harga_beli_unit;
                    delete copy.harga_beli;
                    insertObj = copy;
                }

                try {
                    if (resolvedTable && (resolvedTable === 'master_unit' || (availableCols && availableCols.includes('nama_brand')))) {
                        if (!insertObj.nama_brand || insertObj.nama_brand === null) {
                            insertObj.nama_brand = guessBrand(payload.nama_unit) || 'Unknown';
                        }
                    }
                } catch (e) { }

                const res = await sup.from(resolvedTable).insert([insertObj]).select();
                if (res.error) throw res.error;
                closeModalByEl(form.closest('.simple-modal'));
                await renderList();
                alert('Unit disimpan.');
            } catch (e) {
                console.error('Gagal menambah unit', e);
                alert('Gagal menambah unit: ' + (e && e.message ? e.message : String(e)));
            }
        });

        try {
            const kodeInput = document.getElementById('create-kode-unit');
            const kategoriSel = document.getElementById('create-kategori-unit');
            const kondisiSel = document.getElementById('create-kondisi-unit');
            if (kategoriSel && kondisiSel && kodeInput) {
                const updateKode = async () => {
                    try {
                        const next = await generateNextKodeUnit(kategoriSel.value || 'Ponsel', kondisiSel.value || 'Baru');
                        kodeInput.value = next;
                    } catch (e) { }
                };
                kategoriSel.addEventListener('change', updateKode);
                kondisiSel.addEventListener('change', updateKode);
                setTimeout(updateKode, 10);
            }
        } catch (e) { }
    }

    async function init() {
        await renderList();
        try {
            const panelStatus = document.getElementById('panel-status');
            const resetStatus = document.getElementById('resetStatus');
            const fp = window.filterPanels;
            if (panelStatus) {
                if (panelStatus.parentNode !== document.body) document.body.appendChild(panelStatus);
                panelStatus.style.display = 'none';
                panelStatus.setAttribute('aria-hidden', 'true');
                if (!panelStatus.querySelector('input')) {
                    const opts = [
                        { v: 'Belum diperbaiki', l: 'Belum diperbaiki' },
                        { v: 'Sudah diperbaiki', l: 'Sudah diperbaiki' },
                        { v: 'Terjual', l: 'Terjual' }
                    ];
                    opts.forEach(o => {
                        const lab = document.createElement('label');
                        lab.className = 'filter-option';
                        const inp = document.createElement('input');
                        inp.type = 'checkbox'; inp.name = 'status'; inp.value = o.v; inp.checked = true;
                        inp.addEventListener('change', async (ev) => {
                            const all = Array.from(panelStatus.querySelectorAll('input[type="checkbox"]'));
                            const checkedNow = all.filter(i => i.checked);
                            if (checkedNow.length === 0) { ev.target.checked = true; return; }
                            await renderList();
                            try {
                                const total = panelStatus.querySelectorAll('input[type="checkbox"]').length;
                                const checked = panelStatus.querySelectorAll('input[type="checkbox"]:checked').length;
                                if (resetStatus) resetStatus.textContent = `Status` + (total ? ` (${checked})` : '');
                            } catch (e) { }
                        });
                        const span = document.createElement('span'); span.textContent = o.l;
                        lab.appendChild(inp); lab.appendChild(span);
                        panelStatus.appendChild(lab);
                    });
                }
            }
        } catch (e) { }
        try {
            const headerPanelStok = document.getElementById('panel-stok');
            const headerResetStokBtn = document.getElementById('resetStok');
            const trigger = () => { setTimeout(() => { renderList(); }, 10); };
            if (headerPanelStok) {
                headerPanelStok.addEventListener('change', trigger);
                headerPanelStok.addEventListener('click', trigger);
            }
            if (headerResetStokBtn) headerResetStokBtn.addEventListener('click', trigger);
        } catch (e) { }
    }

    window.appUnitsUI = { init, renderList, openCreateUnitModal, insertUnit };
})();
