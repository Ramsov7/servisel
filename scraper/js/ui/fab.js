/* fab.js - Floating Action Button: clean single-IIFE implementation
   Fixes earlier duplicate/nested IIFE and stray references that could throw at load.
*/

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Create or enhance FAB markup and wire events
    function createFAB() {
        let container = document.querySelector('.fab-container');
        let fabBackdrop = document.querySelector('.fab-backdrop') || null;

        // If container doesn't exist, inject minimal markup so FAB is visible
        if (!container) {
            fabBackdrop = document.createElement('div');
            fabBackdrop.className = 'fab-backdrop';
            fabBackdrop.setAttribute('aria-hidden', 'true');
            document.body.appendChild(fabBackdrop);

            container = document.createElement('div');
            container.className = 'fab-container';
            container.innerHTML = '\n                <button class="fab main-fab" aria-label="Aksi cepat"><span class="fab-icon">+</span></button>\n                <div class="fab-actions" aria-hidden="true" style="display:none">\n                    <button class="fab-action" data-action="servis"><span class="fab-label">Servis</span></button>\n                    <button class="fab-action" data-action="beli"><span class="fab-label">Beli</span></button>\n                    <button class="fab-action" data-action="jual"><span class="fab-label">Jual</span></button>\n                </div>\n            ';
            document.body.appendChild(container);
        }

        const mainFab = container.querySelector('.main-fab');
        const actions = container.querySelector('.fab-actions');
        if (!mainFab || !actions) return;

        mainFab.dataset.defaultIcon = mainFab.dataset.defaultIcon || mainFab.innerHTML;

        mainFab.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const open = actions.getAttribute('aria-hidden') === 'false';
            if (open) closeFAB(); else openFAB();
        });

        function openFAB() {
            actions.setAttribute('aria-hidden', 'false');
            actions.style.display = 'flex';
            if (fabBackdrop) fabBackdrop.setAttribute('aria-hidden', 'false');
            document.body.classList.add('fab-open');
            container.classList.add('open');
            mainFab.classList.add('open');
            try { mainFab.dataset.defaultIcon = mainFab.dataset.defaultIcon || mainFab.innerHTML; mainFab.innerHTML = '<span class="fab-x" aria-hidden="true">×</span>'; } catch (e) { }
        }

        function closeFAB() {
            actions.setAttribute('aria-hidden', 'true');
            actions.style.display = 'none';
            if (fabBackdrop) fabBackdrop.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('fab-open');
            container.classList.remove('open');
            mainFab.classList.remove('open');
            try { mainFab.innerHTML = mainFab.dataset.defaultIcon || mainFab.innerHTML; } catch (e) { }
        }

        actions.querySelectorAll('.fab-action').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const action = btn.dataset.action;
                if (action === 'beli') openBeliForm();
                else if (action === 'servis') openServisForm();
                else if (action === 'jual') openJualForm();
                closeFAB();
            });
        });

        // close when clicking outside
        document.addEventListener('pointerdown', (ev) => {
            if (ev.target.closest('.fab-container') || ev.target.closest('.fab-backdrop')) return;
            closeFAB();
        });
    }

    // ---- Beli flow (Item vs Unit) ----
    function openBeliForm() {
        const kindModal = createSimpleModal('Pilih Tipe Pembelian', '\n            <div class="form-grid">\n                <div class="form-field"><button class="btn btn-primary" id="buy-item">Beli Item</button> <button class="btn btn-secondary" id="buy-unit">Beli Unit</button></div>\n            </div>\n        ', async () => { });

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
        const modal = createSimpleModal('Tambah Pembelian', '\n            <div class="form-grid">\n                <div class="form-field full"><label>Kode Pembelian</label><input name="kode_pembelian" placeholder="(otomatis)"></div>\n                <div class="form-field"><label>Tanggal</label><input name="tanggal" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></div>\n                <div class="form-field"><label>Kode Item</label><input name="kode_item" required autocomplete="off"></div>\n                <div class="form-field"><label>Qty</label><input name="qty" type="number" min="1" value="1" required></div>\n                <div class="form-field"><label>Harga Beli (Rp)</label><input name="harga_beli" type="number" min="0" value="0" required></div>\n                <div class="form-field"><label>Sumber</label><input name="sumber"></div>\n                <div class="form-field full"><label>Catatan</label><textarea name="catatan"></textarea></div>\n            </div>\n        ', async (form) => {
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
        try {
            const main = document.querySelector('main');
            if (!main) return;
            let section = document.getElementById('pembelian-unit');
            const kodePemb = generateKodePembelian();
            const kodeUnitGen = generateKodeUnit();
            const today = new Date().toISOString().slice(0, 10);

            const htmlForm = '\n                <div class="card">\n                    <div class="card-body">\n                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">\n                            <h3 style="margin:0">Tambah Pembelian Unit</h3>\n                            <div>\n                                <button id="back-to-unit-btn" class="btn btn-secondary">Kembali</button>\n                            </div>\n                        </div>\n                        <form id="pembelian-unit-form">\n                            <div class="form-grid">\n                                <div class="form-field full"><label>Kode Pembelian Unit</label><input name="kode_pembelian" value="' + kodePemb + '" readonly></div>\n                                <div class="form-field"><label>Tanggal Pembelian Unit</label><input name="tanggal" type="date" value="' + today + '"></div>\n                                <div class="form-field full inline-row"><label>Cari Tipe Unit (ketik nama tipe)</label>\n                                    <div style="display:flex; gap:8px; width:100%;">\n                                        <input name="tipe_unit" autocomplete="off" style="flex:1; width:auto !important;">\n                                        <button type="button" id="cari-tipe-unit-btn" class="view-master-btn" aria-label="Cari Tipe Unit">Cari</button>\n                                    </div>\n                                </div>\n                                <div class="form-field"><label>Kode Unit</label><input name="kode_unit" value="' + kodeUnitGen + '" readonly></div>\n                                <div class="form-field"><label>Harga Beli Unit</label><input name="harga_beli_unit" type="number" min="0"></div>\n                                <div class="form-field"><label>Lokasi Pembelian</label><input name="lokasi_pembelian"></div>\n                                <div class="form-field"><label><input type="checkbox" name="catat_pembelian"> Catat pembelian unit (opsional)</label></div>\n                                <div class="form-field full"><label>Catatan</label><textarea name="catatan"></textarea></div>\n                            </div>\n                            <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">\n                                <button type="button" id="cancel-pembelian-unit" class="btn btn-secondary">Batal</button>\n                                <button type="submit" class="btn btn-primary">Simpan</button>\n                            </div>\n                        </form>\n                    </div>\n                </div>\n            ';

            if (!section) {
                section = document.createElement('section');
                section.id = 'pembelian-unit';
                section.innerHTML = htmlForm;
                main.appendChild(section);
            } else {
                section.innerHTML = htmlForm;
            }

            document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
            section.classList.add('active');
            // Mark body so CSS hides app chrome and other sections
            try { document.body.classList.add('pembelian-unit-active'); } catch (e) { }
            try { if (window.appNavigation && typeof window.appNavigation.updateHeaderSearchVisibility === 'function') window.appNavigation.updateHeaderSearchVisibility('pembelian-unit'); } catch (e) { }

            const form = section.querySelector('#pembelian-unit-form');
            if (form) {
                form.addEventListener('submit', async (ev) => {
                    ev.preventDefault();
                    const fd = new FormData(form);
                    const tanggal = fd.get('tanggal');
                    const kodeUnit = fd.get('kode_unit');
                    const kodePembelian = fd.get('kode_pembelian') || generateKodePembelian();
                    const hargaBeliUnit = fd.get('harga_beli_unit') ? Number(fd.get('harga_beli_unit')) : null;
                    const lokasi = fd.get('lokasi_pembelian') || null;
                    const catatan = fd.get('catatan') || null;

                    try {
                        const unitPayload = { kode_unit: kodeUnit, nama_unit: fd.get('tipe_unit') || null, harga_beli_unit: hargaBeliUnit, tanggal_masuk: tanggal, catatan };
                        const shouldRecord = !!fd.get('catat_pembelian');
                        const pembPayload = shouldRecord ? { kode_pembelian: kodePembelian, tanggal: tanggal, kode_item: kodeUnit, item_code: kodeUnit, qty: 1, harga_beli: hargaBeliUnit, sumber: lokasi, catatan } : null;

                        if (shouldRecord && window.unitsApiDb && typeof window.unitsApiDb.createUnitWithPembelian === 'function') {
                            try {
                                await window.unitsApiDb.createUnitWithPembelian(unitPayload, pembPayload);
                                if (window.appUnitsUI && typeof window.appUnitsUI.renderList === 'function') await window.appUnitsUI.renderList();
                                if (window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function') await window.appItemsUI.loadAndRenderItems();
                                alert('Pembelian unit dicatat.');
                                const unitBtn = document.querySelector('.bottom-nav button[data-target="unit"]');
                                navigateToUnit();
                            } catch (e) {
                                console.error('RPC createUnitWithPembelian failed', e);
                                // fallback
                                try {
                                    if (!window.appUnitsUI || typeof window.appUnitsUI.insertUnit !== 'function') throw new Error('Fitur pembelian unit belum tersedia (insertUnit)');
                                    await window.appUnitsUI.insertUnit(unitPayload);
                                    if (!window.pembelianApi || typeof window.pembelianApi.addPembelian !== 'function') throw new Error('pembelianApi tidak ditemukan');
                                    await window.pembelianApi.addPembelian(pembPayload);
                                    if (window.appUnitsUI && typeof window.appUnitsUI.renderList === 'function') await window.appUnitsUI.renderList();
                                    if (window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function') await window.appItemsUI.loadAndRenderItems();
                                    alert('Pembelian unit dicatat.');
                                    const unitBtn = document.querySelector('.bottom-nav button[data-target="unit"]');
                                    navigateToUnit();
                                } catch (e2) {
                                    console.error('Fallback create unit + pembelian failed', e2);
                                    alert('Gagal menambah pembelian unit: ' + (e2 && e2.message ? e2.message : String(e2)));
                                }
                            }
                        } else {
                            try {
                                if (!window.appUnitsUI || typeof window.appUnitsUI.insertUnit !== 'function') throw new Error('Fitur pembelian unit belum tersedia (insertUnit)');
                                await window.appUnitsUI.insertUnit(unitPayload);
                                if (shouldRecord) {
                                    if (!window.pembelianApi || typeof window.pembelianApi.addPembelian !== 'function') throw new Error('pembelianApi tidak ditemukan');
                                    await window.pembelianApi.addPembelian(pembPayload);
                                }
                                if (window.appUnitsUI && typeof window.appUnitsUI.renderList === 'function') await window.appUnitsUI.renderList();
                                if (window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function') await window.appItemsUI.loadAndRenderItems();
                                alert(shouldRecord ? 'Pembelian unit dicatat.' : 'Unit disimpan.');
                                const unitBtn = document.querySelector('.bottom-nav button[data-target="unit"]');
                                navigateToUnit();
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

            try {
                const cariBtn = section.querySelector('#cari-tipe-unit-btn');
                if (cariBtn) {
                    cariBtn.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        const input = section.querySelector('input[name="tipe_unit"]');
                        const q = input ? input.value : '';
                        console.log('Cari Tipe Unit (halaman):', q);
                        alert('Tombol Cari ditekan. Fitur pencarian belum diimplementasikan.');
                    });
                }
            } catch (e) { }

            try {
                const backBtn = section.querySelector('#back-to-unit-btn');
                const cancelBtn = section.querySelector('#cancel-pembelian-unit');
                const goBack = () => {
                    try { document.body.classList.remove('pembelian-unit-active'); } catch (e) { }
                    const unitBtn = document.querySelector('.bottom-nav button[data-target="unit"]');
                    navigateToUnit();
                };
                if (backBtn) backBtn.addEventListener('click', (ev) => { ev.preventDefault(); goBack(); });
                if (cancelBtn) cancelBtn.addEventListener('click', (ev) => { ev.preventDefault(); goBack(); });
            } catch (e) { }

        } catch (e) {
            console.error('openUnitPurchaseForm (page) error', e);
        }
    }

    // ---- Servis / Jual forms (simpler) ----
    function openServisForm() {
        const modal = createSimpleModal('Catat Servis (Perbaikan)', '\n            <label>Tanggal: <input name="tanggal" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></label>\n            <label>Kode Unit: <input name="kode_unit" required></label>\n            <label>Catatan: <textarea name="catatan"></textarea></label>\n        ', async (form) => {
            const fd = new FormData(form);
            const kodeUnit = fd.get('kode_unit');
            alert('Catat servis: fitur lanjut belum otomatis. Kode Unit: ' + kodeUnit);
            closeModalByEl(form.closest('.simple-modal'));
        });
    }

    function openJualForm() {
        const modal = createSimpleModal('Catat Penjualan Unit', '\n            <label>Tanggal: <input name="tanggal" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></label>\n            <label>Kode Unit: <input name="kode_unit" required></label>\n            <label>Harga Jual: <input name="harga_jual" type="number" min="0" required></label>\n            <label>Catatan: <textarea name="catatan"></textarea></label>\n        ', async (form) => {
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
        modal.innerHTML = '\n            <div class="modal-backdrop" data-action="close"></div>\n            <div class="modal-window">\n                <div class="modal-header"><h3>' + escapeHtml(title) + '</h3><button class="modal-close" aria-label="Tutup">×</button></div>\n                <form class="modal-form"><div class="modal-body">' + innerHTML + '</div><div class="modal-actions"><button type="button" class="btn btn-secondary cancel">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div></form>\n            </div>\n        ';
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
        if (el.parentNode) el.parentNode.removeChild(el);
        try { document.body.classList.remove('modal-open'); } catch (e) { }
    }

    // ---- Generators ----
    function generateKodePembelian() {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
        return 'PB-' + ts + '-' + rand;
    }

    function generateKodeTransaksi() {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
        return 'TRX-' + ts + '-' + rand;
    }

    function generateKodeUnit() {
        const ts = Date.now().toString(36).toUpperCase().slice(-6);
        const rand = Math.random().toString(36).substr(2, 3).toUpperCase();
        return 'U-' + ts + '-' + rand;
    }

    // Helper to close/remove pembelian-unit page to avoid it lingering in DOM
    function closePembelianUnitPage() {
        try { document.body.classList.remove('pembelian-unit-active'); } catch (e) { }
        try {
            const section = document.getElementById('pembelian-unit');
            if (section && section.parentNode) section.parentNode.removeChild(section);
        } catch (e) { }
    }

    function navigateToUnit() {
        try { closePembelianUnitPage(); } catch (e) { }
        try {
            const unitBtn = document.querySelector('.bottom-nav button[data-target="unit"]');
            if (unitBtn) unitBtn.click();
            else {
                document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
                const unitSection = document.getElementById('unit'); if (unitSection) unitSection.classList.add('active');
            }
        } catch (e) { }
    }

    // public init
    function initFAB() { createFAB(); }

    window.appFAB = { initFAB };
})();
