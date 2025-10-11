/* fab.js - Floating Action Button: lightweight, syntactically-clean version
   Provides three quick actions: Beli (purchase), Servis, Jual.
   The Beli flow prompts Item vs Unit and calls available helpers:
   - For items: pembelianApi.addPembelian
   - For units: appUnitsUI.insertUnit + pembelianApi.addPembelian
*/

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Create a minimal FAB wiring; if `.fab-container` is missing, create
    // a small fallback DOM so the FAB is visible and usable.
    function createFAB() {
        let container = document.querySelector('.fab-container');
        let fabBackdrop = document.querySelector('.fab-backdrop') || null;

        // If container doesn't exist, inject minimal markup so FAB is visible
        if (!container) {
            // create backdrop
            fabBackdrop = document.createElement('div');
            fabBackdrop.className = 'fab-backdrop';
            fabBackdrop.setAttribute('aria-hidden', 'true');
            document.body.appendChild(fabBackdrop);

            // create container with default actions
            container = document.createElement('div');
            container.className = 'fab-container';
            container.innerHTML = `
                <button class="fab main-fab" aria-label="Aksi cepat"><span class="fab-icon">+</span></button>
                <div class="fab-actions" aria-hidden="true" style="display:none">
                    <button class="fab-action" data-action="servis"><span class="fab-label">Servis</span></button>
                    <button class="fab-action" data-action="beli"><span class="fab-label">Beli</span></button>
                    <button class="fab-action" data-action="jual"><span class="fab-label">Jual</span></button>
                </div>
            `;
            document.body.appendChild(container);
        }

        const mainFab = container.querySelector('.main-fab');
        const actions = container.querySelector('.fab-actions');
        if (!mainFab || !actions) return;

        // remember default icon/html so we can swap to a close '×' and restore later
        mainFab.dataset.defaultIcon = mainFab.dataset.defaultIcon || mainFab.innerHTML;

        // toggle open/close
        mainFab.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const open = actions.getAttribute('aria-hidden') === 'false';
            if (open) {
                actions.setAttribute('aria-hidden', 'true');
                actions.style.display = 'none';
                if (fabBackdrop) fabBackdrop.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('fab-open');
                container.classList.remove('open');
                // restore main FAB visual state and original icon/html
                mainFab.classList.remove('open');
                try { mainFab.innerHTML = mainFab.dataset.defaultIcon || mainFab.innerHTML; } catch (e) { /* ignore */ }
            } else {
                actions.setAttribute('aria-hidden', 'false');
                actions.style.display = 'flex';
                if (fabBackdrop) fabBackdrop.setAttribute('aria-hidden', 'false');
                document.body.classList.add('fab-open');
                // add open class so CSS positions/animates the action buttons
                container.classList.add('open');
                // mark FAB as open and replace innerHTML with a close '×' symbol
                mainFab.classList.add('open');
                try {
                    // store defaultIcon if not already stored
                    mainFab.dataset.defaultIcon = mainFab.dataset.defaultIcon || mainFab.innerHTML;
                    mainFab.innerHTML = '<span class="fab-x" aria-hidden="true">×</span>';
                } catch (e) { /* ignore DOM write errors in odd environments */ }
            }
        });

        // wire quick action buttons
        actions.querySelectorAll('.fab-action').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const action = btn.dataset.action;
                if (action === 'beli') openBeliForm();
                else if (action === 'servis') openServisForm();
                else if (action === 'jual') openJualForm();
                // close
                actions.setAttribute('aria-hidden', 'true');
                actions.style.display = 'none';
                if (fabBackdrop) fabBackdrop.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('fab-open');
                // ensure FAB resets visual open state and restore icon
                mainFab.classList.remove('open');
                try { mainFab.innerHTML = mainFab.dataset.defaultIcon || mainFab.innerHTML; } catch (e) { /* ignore */ }
            });
        });

        // close when clicking outside
        document.addEventListener('pointerdown', (ev) => {
            if (ev.target.closest('.fab-container') || ev.target.closest('.fab-backdrop')) return;
            actions.setAttribute('aria-hidden', 'true');
            actions.style.display = 'none';
            if (fabBackdrop) fabBackdrop.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('fab-open');
            container.classList.remove('open');
            // ensure FAB resets visual open state and restore icon
            mainFab.classList.remove('open');
            try { mainFab.innerHTML = mainFab.dataset.defaultIcon || mainFab.innerHTML; } catch (e) { /* ignore */ }
        });
    }

    // ---- Beli flow (Item vs Unit) ----
    function openBeliForm() {
        const kindModal = createSimpleModal('Pilih Tipe Pembelian', `
            <div class="form-grid">
                <div class="form-field"><button class="btn btn-primary" id="buy-item">Beli Item</button> <button class="btn btn-secondary" id="buy-unit">Beli Unit</button></div>
            </div>
        `, async () => { });

        kindModal.querySelector('#buy-item').addEventListener('click', (ev) => {
            ev.preventDefault();
            closeModalByEl(kindModal);
            openItemPurchaseForm();
        });

        kindModal.querySelector('#buy-unit').addEventListener('click', (ev) => {
            ev.preventDefault();
            closeModalByEl(kindModal);
            openUnitPurchaseForm();
        });
    }

    function openItemPurchaseForm() {
        const modal = createSimpleModal('Tambah Pembelian', `
            <div class="form-grid">
                <div class="form-field full"><label>Kode Pembelian</label><input name="kode_pembelian" placeholder="(otomatis)"></div>
                <div class="form-field"><label>Tanggal</label><input name="tanggal" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
                <div class="form-field"><label>Kode Item</label><input name="kode_item" required autocomplete="off"></div>
                <div class="form-field"><label>Qty</label><input name="qty" type="number" min="1" value="1" required></div>
                <div class="form-field"><label>Harga Beli (Rp)</label><input name="harga_beli" type="number" min="0" value="0" required></div>
                <div class="form-field"><label>Sumber</label><input name="sumber"></div>
                <div class="form-field full"><label>Catatan</label><textarea name="catatan"></textarea></div>
            </div>
        `, async (form) => {
            const fd = new FormData(form);
            const kodeItem = fd.get('kode_item');
            if (!kodeItem) { alert('Masukkan kode item'); return; }

            const payload = {
                kode_pembelian: fd.get('kode_pembelian') || generateKodePembelian(),
                tanggal: fd.get('tanggal'),
                kode_item: kodeItem,
                item_code: kodeItem,
                qty: Number(fd.get('qty') || 0),
                harga_beli: Number(fd.get('harga_beli') || 0),
                sumber: fd.get('sumber') || null,
                catatan: fd.get('catatan') || null
            };

            try {
                if (!window.pembelianApi || typeof window.pembelianApi.addPembelian !== 'function') throw new Error('pembelianApi tidak tersedia');
                await window.pembelianApi.addPembelian(payload);
                if (window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function') await window.appItemsUI.loadAndRenderItems();
                closeModalByEl(form.closest('.simple-modal'));
                alert('Pembelian dicatat.');
            } catch (e) {
                console.error(e);
                alert('Gagal menambah pembelian: ' + (e && e.message ? e.message : String(e)));
            }
        });
    }

    function openUnitPurchaseForm() {
        const modal = createSimpleModal('Tambah Pembelian Unit', `
            <div class="form-grid">
                <div class="form-field full"><label>Kode Pembelian Unit</label><input name="kode_pembelian" value="${generateKodePembelian()}" readonly></div>
                <div class="form-field"><label>Tanggal Pembelian Unit</label><input name="tanggal" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
                        <div class="form-field full"><label>Cari Tipe Unit (ketik nama tipe)</label><input name="tipe_unit" autocomplete="off"></div>
                <div class="form-field"><label>Kode Unit</label><input name="kode_unit" value="${generateKodeUnit()}" readonly></div>
                <div class="form-field"><label>Harga Beli Unit</label><input name="harga_beli_unit" type="number" min="0"></div>
                        <div class="form-field"><label>Lokasi Pembelian</label><input name="lokasi_pembelian"></div>
                        <div class="form-field"><label><input type="checkbox" name="catat_pembelian"> Catat pembelian unit (opsional)</label></div>
                <div class="form-field full"><label>Catatan</label><textarea name="catatan"></textarea></div>
            </div>
        `, async (form) => {
            const fd = new FormData(form);
            const tanggal = fd.get('tanggal');
            const kodeUnit = fd.get('kode_unit');
            const kodePembelian = fd.get('kode_pembelian') || generateKodePembelian();
            const hargaBeliUnit = fd.get('harga_beli_unit') ? Number(fd.get('harga_beli_unit')) : null;
            const lokasi = fd.get('lokasi_pembelian') || null;
            const catatan = fd.get('catatan') || null;

            try {
                // Build payloads
                const unitPayload = { kode_unit: kodeUnit, nama_unit: fd.get('tipe_unit') || null, harga_beli_unit: hargaBeliUnit, tanggal_masuk: tanggal, catatan };
                const shouldRecord = !!fd.get('catat_pembelian');
                const pembPayload = shouldRecord ? { kode_pembelian: kodePembelian, tanggal: tanggal, kode_item: kodeUnit, item_code: kodeUnit, qty: 1, harga_beli: hargaBeliUnit, sumber: lokasi, catatan } : null;

                // If RPC is available, prefer transactional RPC to ensure atomic insert
                if (shouldRecord && window.unitsApiDb && typeof window.unitsApiDb.createUnitWithPembelian === 'function') {
                    try {
                        const res = await window.unitsApiDb.createUnitWithPembelian(unitPayload, pembPayload);
                        // success: refresh UI
                        closeModalByEl(form.closest('.simple-modal'));
                        if (window.appUnitsUI && typeof window.appUnitsUI.renderList === 'function') await window.appUnitsUI.renderList();
                        if (window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function') await window.appItemsUI.loadAndRenderItems();
                        alert('Pembelian unit dicatat.');
                    } catch (e) {
                        console.error('RPC createUnitWithPembelian failed', e);
                        // fallback to old behavior: try client-side insert + pembelian
                        try {
                            if (!window.appUnitsUI || typeof window.appUnitsUI.insertUnit !== 'function') throw new Error('Fitur pembelian unit belum tersedia (insertUnit)');
                            await window.appUnitsUI.insertUnit(unitPayload);
                            if (!window.pembelianApi || typeof window.pembelianApi.addPembelian !== 'function') throw new Error('pembelianApi tidak ditemukan');
                            await window.pembelianApi.addPembelian(pembPayload);
                            closeModalByEl(form.closest('.simple-modal'));
                            if (window.appUnitsUI && typeof window.appUnitsUI.renderList === 'function') await window.appUnitsUI.renderList();
                            if (window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function') await window.appItemsUI.loadAndRenderItems();
                            alert('Pembelian unit dicatat.');
                        } catch (e2) {
                            console.error('Fallback create unit + pembelian failed', e2);
                            alert('Gagal menambah pembelian unit: ' + (e2 && e2.message ? e2.message : String(e2)));
                        }
                    }
                } else {
                    // No RPC or user didn't request pembelian — perform local insert (and optional pembelian)
                    try {
                        if (!window.appUnitsUI || typeof window.appUnitsUI.insertUnit !== 'function') throw new Error('Fitur pembelian unit belum tersedia (insertUnit)');
                        await window.appUnitsUI.insertUnit(unitPayload);
                        if (shouldRecord) {
                            if (!window.pembelianApi || typeof window.pembelianApi.addPembelian !== 'function') throw new Error('pembelianApi tidak ditemukan');
                            await window.pembelianApi.addPembelian(pembPayload);
                        }
                        closeModalByEl(form.closest('.simple-modal'));
                        if (window.appUnitsUI && typeof window.appUnitsUI.renderList === 'function') await window.appUnitsUI.renderList();
                        if (window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function') await window.appItemsUI.loadAndRenderItems();
                        alert(shouldRecord ? 'Pembelian unit dicatat.' : 'Unit disimpan.');
                    } catch (e) {
                        console.error('Gagal menambah pembelian unit', e);
                        alert('Gagal menambah pembelian unit: ' + (e && e.message ? e.message : String(e)));
                    }
                }
            } catch (e) {
                console.error('Gagal menambah pembelian unit', e);
                alert('Gagal menambah pembelian unit: ' + (e && e.message ? e.message : String(e)));
            }
        });
    }

    // ---- Servis / Jual forms (simpler) ----
    function openServisForm() {
        const modal = createSimpleModal('Catat Servis (Perbaikan)', `
            <label>Tanggal: <input name="tanggal" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
            <label>Kode Unit: <input name="kode_unit" required></label>
            <label>Catatan: <textarea name="catatan"></textarea></label>
        `, async (form) => {
            // lightweight handler: delegate to existing APIs or notify user to implement
            const fd = new FormData(form);
            const kodeUnit = fd.get('kode_unit');
            alert('Catat servis: fitur lanjut belum otomatis. Kode Unit: ' + kodeUnit);
            closeModalByEl(form.closest('.simple-modal'));
        });
    }

    function openJualForm() {
        const modal = createSimpleModal('Catat Penjualan Unit', `
            <label>Tanggal: <input name="tanggal" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
            <label>Kode Unit: <input name="kode_unit" required></label>
            <label>Harga Jual: <input name="harga_jual" type="number" min="0" required></label>
            <label>Catatan: <textarea name="catatan"></textarea></label>
        `, async (form) => {
            const fd = new FormData(form);
            const kodeUnit = fd.get('kode_unit');
            alert('Catat penjualan untuk ' + kodeUnit + ' (silakan implementasikan penyimpanan jika diperlukan)');
            closeModalByEl(form.closest('.simple-modal'));
        });
    }

    // ---- Modal helpers ----
    function createSimpleModal(title, innerHTML, onSubmit) {
        const modal = document.createElement('div');
        modal.className = 'simple-modal modal';
        modal.setAttribute('aria-hidden', 'false');
        modal.innerHTML = `
            <div class="modal-backdrop" data-action="close"></div>
            <div class="modal-window">
                <div class="modal-header"><h3>${escapeHtml(title)}</h3><button class="modal-close" aria-label="Tutup">×</button></div>
                <form class="modal-form"><div class="modal-body">${innerHTML}</div><div class="modal-actions"><button type="button" class="btn btn-secondary cancel">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div></form>
            </div>
        `;
        document.body.appendChild(modal);
        try { document.body.classList.add('modal-open'); } catch (e) { /* ignore */ }
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
        if (el.parentNode) el.parentNode.removeChild(el);
        try { document.body.classList.remove('modal-open'); } catch (e) { /* ignore */ }
    }

    // ---- Generators ----
    function generateKodePembelian() {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `PB-${ts}-${rand}`;
    }

    function generateKodeTransaksi() {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `TRX-${ts}-${rand}`;
    }

    function generateKodeUnit() {
        const ts = Date.now().toString(36).toUpperCase().slice(-6);
        const rand = Math.random().toString(36).substr(2, 3).toUpperCase();
        return `U-${ts}-${rand}`;
    }

    // public init
    function initFAB() { createFAB(); }

    window.appFAB = { initFAB };
})();
