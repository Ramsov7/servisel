/* jasaUI.js — compatibility wrapper (loads canonical kebab-case file)
   Keeps older references working while canonical file is `jasa-ui.js`. */

(function () {
    if (typeof window === 'undefined') return;
    if (window.appJasaUI) return;
    try {
        const s = document.createElement('script');
        s.src = 'js/ui/jasa-ui.js';
        s.async = false;
        document.head.appendChild(s);
    } catch (e) { }
})();
/* jasaUI.js — UI for Jasa (service catalog) */

(function () {
    const container = document.getElementById('lainnya');

    async function renderList() {
        if (!container) return;
        try {
            let list = [];
            if (window.jasaApiNew && typeof window.jasaApiNew.listJasaNew === 'function') {
                list = await window.jasaApiNew.listJasaNew();
            } else {
                list = await jasaApi.listJasa();
            }
            // normalize list items so UI uses legacy keys (kode_jasa, nama, harga)
            const normalized = (list || []).map(j => ({
                kode_jasa: j.kode_jasa || j.id_jasa || null,
                id_jasa: j.id_jasa || null,
                nama: j.nama || j.nama_jasa || null,
                harga: j.harga ?? j.tarif ?? 0,
                deskripsi: j.deskripsi || null,
                kategori: j.kategori || null,
                aktif: typeof j.aktif === 'boolean' ? j.aktif : true,
                _raw: j
            }));
            const useList = normalized;
            const card = container.querySelector('.card');
            if (!card) return;

            // clear old content
            const existing = card.querySelector('.card-body');
            if (existing) existing.remove();

            const cb = document.createElement('div');
            cb.className = 'card-body jasa-body';

            // toolbar is provided by the shared header controls; do not render
            // a separate add button here to avoid duplicate actions.

            // read layanan filter (panel-stok acts as layanan on Jasa page)
            let layananFilter = '';
            try {
                const sel = document.querySelector('#panel-stok')?.querySelector('input[type="radio"]:checked');
                if (sel) layananFilter = sel.value || '';
            } catch (e) { /* ignore */ }

            // list container (use same grid classes as items/units so empty-state sizing and
            // responsive behavior match exactly)
            const listWrap = document.createElement('div');
            listWrap.className = 'jasa-list items-grid grid-2cols';
            // Inline enforcement: set grid layout properties on the wrapper so it
            // behaves exactly like `.items-grid` even if CSS fails to load or is
            // overridden by other rules. This guarantees visual parity for the
            // empty-state placeholder.
            try {
                listWrap.style.display = 'grid';
                listWrap.style.gridTemplateColumns = 'repeat(2, 1fr)';
                listWrap.style.gap = '14px';
                listWrap.style.alignItems = 'start';
            } catch (e) { /* ignore styling errors */ }

            // apply layanan filter if present
            let filtered = useList;
            if (layananFilter) {
                filtered = (useList || []).filter(j => String(j.kategori || '').toLowerCase() === String(layananFilter || '').toLowerCase());
            }

            if (!filtered || filtered.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty-state empty-centered';
                empty.innerHTML = `<p>Belum ada daftar jasa atau layanan.</p>`;
                // Runtime fallback: enforce exact sizing/alignment to match Item/Unit placeholders.
                // This guards against situations where CSS isn't applied or inline styles from
                // other code interfere with the visual parity.
                try {
                    empty.style.boxSizing = 'border-box';
                    empty.style.width = '100%';
                    empty.style.minHeight = '220px';
                    empty.style.padding = '18px';
                    empty.style.display = 'flex';
                    empty.style.alignItems = 'center';
                    empty.style.justifyContent = 'center';
                    empty.style.margin = '0';
                } catch (e) { /* ignore if styling fails on older browsers */ }
                listWrap.appendChild(empty);
            } else {
                filtered.forEach(j => {
                    const item = document.createElement('div');
                    item.className = 'jasa-item';
                    item.innerHTML = `
                        <div class="jasa-main">
                            <div class="jasa-name">${escapeHtml(j.nama)}</div>
                            <div class="jasa-meta">${escapeHtml(j.kategori || '')} ${j.deskripsi ? ' ' + escapeHtml(j.deskripsi) : ''}</div>
                        </div>
                        <div class="jasa-actions">
                            <div class="jasa-price">Rp ${Number(j.harga || 0).toLocaleString()}</div>
                                <button class="btn btn-secondary btn-charge" data-kode="${j.kode_jasa}">Catat</button>
                                <button class="btn btn-danger btn-delete" data-kode="${j.kode_jasa}" title="Hapus Jasa">Hapus</button>
                        </div>
                    `;
                    listWrap.appendChild(item);
                });
            }

            cb.appendChild(listWrap);
            card.appendChild(cb);

            // wire charge buttons
            cb.querySelectorAll('.btn-charge').forEach(b => b.addEventListener('click', async (ev) => {
                const kode = b.dataset.kode;
                const jasa = list.find(x => x.kode_jasa === kode);
                if (!jasa) return alert('Data jasa tidak ditemukan');
                openChargeModal(jasa);
            }));

            // delete handlers
            cb.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', async (ev) => {
                const kode = b.dataset.kode;
                if (!confirm('Yakin ingin menghapus jasa/layanan ini? Tindakan ini tidak dapat dibatalkan.')) return;
                try {
                    await jasaApi.deleteJasa(kode);
                    await renderList();
                    alert('Jasa berhasil dihapus.');
                } catch (e) {
                    console.error('Gagal menghapus jasa', e);
                    alert('Gagal menghapus jasa: ' + (e.message || e));
                }
            }));

        } catch (e) {
            console.error('Gagal memuat daftar jasa', e);
            const card = container.querySelector('.card');
            if (card) {
                const err = document.createElement('p'); err.textContent = 'Gagal memuat daftar jasa: ' + (e.message || e);
                card.appendChild(err);
            }
        }
    }

    function openChargeModal(jasa) {
        // default kategori in charge modal: prefer selected layanan filter if set
        let defaultKategori = escapeHtml(jasa.nama);
        try {
            const sel = document.querySelector('#panel-stok')?.querySelector('input[type="radio"]:checked');
            if (sel && sel.value) defaultKategori = escapeHtml(sel.value);
        } catch (e) { /* ignore */ }

        const modal = createSimpleModal('Catat Jasa untuk ' + jasa.nama, `
            <div class="form-grid">
                <div class="form-field full"><label>Tanggal</label><input name="tanggal" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
                <div class="form-field"><label>Kategori</label><input name="kategori" value="${defaultKategori}"></div>
                <div class="form-field"><label>Jumlah (Rp)</label><input name="jumlah" type="number" value="${jasa.harga || 0}"></div>
                <div class="form-field full"><label>Catatan</label><textarea name="catatan"></textarea></div>
            </div>
        `, async (form) => {
            const fd = new FormData(form);
            try {
                await expensesApi.addExpense({ tanggal: fd.get('tanggal'), kategori: fd.get('kategori'), jumlah: Number(fd.get('jumlah') || 0), catatan: fd.get('catatan') || null });
                closeModalByEl(form.closest('.simple-modal'));
                alert('Jasa dicatat.');
            } catch (e) { console.error(e); alert('Gagal menyimpan jasa: ' + (e.message || e)); }
        });
    }

    async function openAddJasaModal() {
        // initial category default
        const initialKategori = 'Jasa';
        // generate kode based on initial kategori and set as readonly value so user cannot change it
        let defaultKodeJasa = '';
        try { defaultKodeJasa = await generateNextKodeJasa(initialKategori); } catch (e) { defaultKodeJasa = 'JS0001'; }

        const modal = createSimpleModal('Tambah Jasa / Layanan Baru', `
            <div class="form-grid">
                <div class="form-field full inline-row"><label>Kode Jasa / Layanan</label><input type="text" name="kode_jasa" value="${defaultKodeJasa}" readonly style="box-sizing:border-box;padding:12px 14px;height:44px;background:var(--modal-input-bg, #0b1220);color:var(--modal-input-fg, #e6eef8);border:1px solid var(--modal-input-border, rgba(255,255,255,0.06));"><span class="muted">(Dibuat secara otomatis)</span></div>
                <div class="form-field full"><label>Nama Jasa / Layanan</label><input type="text" name="nama" placeholder="Nama Jasa / Layanan" required style="box-sizing:border-box;padding:12px 14px;height:44px;background:var(--modal-input-bg, #0b1220);color:var(--modal-input-fg, #e6eef8);border:1px solid var(--modal-input-border, rgba(255,255,255,0.06));"></div>
                <div class="form-field full"><label>Kategori</label>
                    <select name="kategori">
                        <option value="Jasa">Jasa</option>
                        <option value="Layanan">Layanan</option>
                    </select>
                </div>
                <div class="form-field full masa-berlaku-field" style="display:none"><label>Masa Berlaku Layanan</label><input type="date" name="masa_berlaku"></div>
                <div class="form-field full"><label>Deskripsi</label><textarea name="deskripsi"></textarea></div>
                <div class="form-field full"><label>Harga (Rp)</label><input name="harga" type="number" value="0"></div>
            </div>
        `, async (form) => {
            const fd = new FormData(form);
            // Note: 'masa_berlaku' is an optional UI field but not present in DB schema.
            // Do not send it to the server to avoid schema errors.
            const rawKategori = fd.get('kategori') || 'Jasa';
            const payloadNew = {
                nama_jasa: fd.get('nama'),
                tarif: Number(fd.get('harga') || 0),
                deskripsi: fd.get('deskripsi') || null,
                kategori: rawKategori,
                aktif: true
            };
            try {
                if (window.jasaApiNew && typeof window.jasaApiNew.createJasa === 'function') {
                    await window.jasaApiNew.createJasa(payloadNew);
                } else {
                    // fallback to legacy
                    const payload = {
                        kode_jasa: fd.get('kode_jasa') || (await generateNextKodeJasa(rawKategori)),
                        nama: fd.get('nama'),
                        deskripsi: fd.get('deskripsi') || null,
                        harga: Number(fd.get('harga') || 0),
                        kategori: rawKategori,
                        aktif: true
                    };
                    await jasaApi.addJasa(payload);
                }
                closeModalByEl(form.closest('.simple-modal'));
                await renderList();
                alert('Jasa disimpan.');
            } catch (e) { console.error(e); alert('Gagal menyimpan jasa: ' + (e.message || e)); }
        });

        // wire kategori select to toggle masa_berlaku field and update kode when changed
        try {
            const select = modal.querySelector('select[name="kategori"]');
            const masaField = modal.querySelector('.masa-berlaku-field');
            const kodeInput = modal.querySelector('input[name="kode_jasa"]');
            if (select && masaField) {
                const toggle = () => { masaField.style.display = (select.value === 'Layanan') ? '' : 'none'; };
                select.addEventListener('change', async () => {
                    try { toggle(); } catch (e) { /* ignore */ }
                    try {
                        if (kodeInput) {
                            const next = await generateNextKodeJasa(select.value || 'Jasa');
                            kodeInput.value = next;
                        }
                    } catch (e) { /* ignore */ }
                });
                // initial state
                toggle();
            }
        } catch (e) { /* ignore wiring errors */ }
    }

    // Generate next kode_jasa for a given kategori ('Jasa' or 'Layanan') using sequential 4-digit suffix
    async function generateNextKodeJasa(kategori) {
        const supList = (typeof jasaApi === 'object' && typeof jasaApi.listJasa === 'function') ? jasaApi.listJasa : null;
        const pref = (String(kategori || '').toLowerCase() === 'layanan') ? 'LY' : 'JS';
        let existing = [];
        try {
            if (supList) existing = await jasaApi.listJasa(1000);
        } catch (e) { existing = []; }

        // find numeric suffixes of existing codes that match prefix
        let max = 0;
        const re = new RegExp('^' + pref + '(0*)(\\d+)$', 'i');
        (existing || []).forEach(j => {
            const k = (j.kode_jasa || '').toString();
            const m = k.match(re);
            if (m && m[2]) {
                const num = parseInt(m[2], 10);
                if (!isNaN(num) && num > max) max = num;
            }
        });
        const next = max + 1;
        const suffix = String(next).padStart(4, '0');
        return `${pref}${suffix}`;
    }

    // small helpers used from other modules
    function createSimpleModal(title, innerHTML, onSubmit) {
        if (window.appFAB && typeof window.appFAB.createSimpleModal === 'function') return window.appFAB.createSimpleModal(title, innerHTML, onSubmit);
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

    function closeModalByEl(el) {
        if (!el) return;
        el.setAttribute('aria-hidden', 'true');
        try { document.body.classList.remove('modal-open'); } catch (e) { }
        if (el.parentNode) el.parentNode.removeChild(el);
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function init() {
        await renderList();

        // Wire the shared header add button to open the Jasa add modal
        // only when the jasa section is active. Use a stored handler
        // reference on the element to avoid duplicate bindings.
        try {
            const headerAddBtn = document.querySelector('.add-btn');
            if (headerAddBtn) {
                if (headerAddBtn.__jasaHandler) headerAddBtn.removeEventListener('click', headerAddBtn.__jasaHandler);
                const handler = function (e) {
                    if (!container) return;
                    if (container.classList.contains('active')) {
                        e.preventDefault();
                        openAddJasaModal();
                    }
                };
                headerAddBtn.addEventListener('click', handler);
                headerAddBtn.__jasaHandler = handler;
            }
        } catch (e) { /* ignore wiring errors */ }
        // Ensure we don't show the 'Lihat Master' header control on Jasa page
        try {
            const vm = document.querySelector('#header-dropdowns .select-row .view-master-btn');
            if (vm) vm.style.display = 'none';
        } catch (e) { /* ignore */ }

        // Defensive: ensure header back/master elements are not present on Jasa page
        try {
            const selectRowInner = document.querySelector('#header-dropdowns .select-row');
            const maybeBack = selectRowInner && selectRowInner.querySelector('.back-btn');
            if (maybeBack && maybeBack.parentNode) maybeBack.parentNode.removeChild(maybeBack);
            const maybeMH = selectRowInner && selectRowInner.querySelector('.master-header');
            if (maybeMH && maybeMH.parentNode) maybeMH.parentNode.removeChild(maybeMH);
        } catch (e) { /* ignore */ }
    }

    window.appJasaUI = { init, renderList };
})();
