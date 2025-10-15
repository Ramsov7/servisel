/* jasa-ui.js — kebab-case copy of jasaUI.js (logic unchanged) */

(function () {
    const container = document.getElementById('jasa');

    function escapeHtml(s) { if (s === null || s === undefined) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    async function renderList(jasaApi) {
        if (!container) return;
        try {
            const { data, error } = await jasaApi.listJasa();
            const card = container.querySelector('.card');
            if (!card) return;
            const existing = card.querySelector('.card-body');
            if (existing) existing.remove();
            const cb = document.createElement('div'); cb.className = 'card-body';
            const list = document.createElement('div'); list.className = 'list-wrap';
            if (error) {
                const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = `<p>Gagal memuat jasa</p>`; list.appendChild(empty);
            } else if (!data || !data.length) {
                const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = `<p>Belum ada jasa.</p>`; list.appendChild(empty);
            } else {
                const ul = document.createElement('div'); ul.className = 'items-list';
                data.forEach(j => {
                    const item = document.createElement('div'); item.className = 'list-item';
                    item.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(j.nama_jasa || j.nama)}</div><div class="item-sub">${escapeHtml(j.keterangan || '')}</div></div><div class="item-meta">Rp ${Number(j.harga || 0).toLocaleString()}</div>`;
                    ul.appendChild(item);
                });
                list.appendChild(ul);
            }
            cb.appendChild(list);
            card.appendChild(cb);
        } catch (e) { console.error('gagal render jasa list', e); }
    }

    function openChargeModal(jasa, onSubmit) {
        const modal = document.createElement('div'); modal.className = 'simple-modal modal'; modal.innerHTML = `
            <div class="modal-backdrop" data-action="close"></div>
            <div class="modal-window">
                <div class="modal-header"><h3>Tambahkan Pengeluaran - ${escapeHtml(jasa.nama_jasa || jasa.nama || '')}</h3><button class="modal-close">×</button></div>
                <form class="modal-form"><div class="modal-body">
                    <div class="form-field"><label>Nominal <input name="nominal" type="number" required></label></div>
                    <div class="form-field"><label>Catatan <input name="catatan"></label></div>
                </div><div class="modal-actions"><button type="button" class="btn cancel">Batal</button><button type="submit" class="btn primary">Simpan</button></div></form>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
        modal.querySelector('.modal-backdrop').addEventListener('click', () => { modal.remove(); document.body.classList.remove('modal-open'); });
        modal.querySelector('.modal-close').addEventListener('click', () => { modal.remove(); document.body.classList.remove('modal-open'); });
        modal.querySelector('.cancel').addEventListener('click', () => { modal.remove(); document.body.classList.remove('modal-open'); });
        modal.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); const payload = { nominal: Number(fd.get('nominal')), catatan: fd.get('catatan') }; if (typeof onSubmit === 'function') onSubmit(payload); modal.remove(); document.body.classList.remove('modal-open'); });
    }

    function openAddJasaModal(defaultKode, onSubmit) {
        const modal = document.createElement('div'); modal.className = 'simple-modal modal'; modal.innerHTML = `
            <div class="modal-backdrop" data-action="close"></div>
            <div class="modal-window">
                <div class="modal-header"><h3>Tambah Jasa</h3><button class="modal-close">×</button></div>
                <form class="modal-form"><div class="modal-body">
                    <div class="form-field"><label>Kode <input name="kode_jasa" value="${escapeHtml(defaultKode || '')}" required></label></div>
                    <div class="form-field"><label>Nama <input name="nama_jasa" required></label></div>
                    <div class="form-field"><label>Harga <input name="harga" type="number"></label></div>
                </div><div class="modal-actions"><button type="button" class="btn cancel">Batal</button><button type="submit" class="btn primary">Simpan</button></div></form>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
        modal.querySelector('.modal-backdrop').addEventListener('click', () => { modal.remove(); document.body.classList.remove('modal-open'); });
        modal.querySelector('.modal-close').addEventListener('click', () => { modal.remove(); document.body.classList.remove('modal-open'); });
        modal.querySelector('.cancel').addEventListener('click', () => { modal.remove(); document.body.classList.remove('modal-open'); });
        modal.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); const payload = { kode_jasa: fd.get('kode_jasa'), nama_jasa: fd.get('nama_jasa'), harga: Number(fd.get('harga')) }; if (typeof onSubmit === 'function') onSubmit(payload); modal.remove(); document.body.classList.remove('modal-open'); });
    }

    function generateNextKodeJasa() { return 'JSA-' + Date.now().toString(36).toUpperCase().slice(-6); }

    window.appJasaUI = { renderList, openChargeModal, openAddJasaModal, generateNextKodeJasa };
})();
