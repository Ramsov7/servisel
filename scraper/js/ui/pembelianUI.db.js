/* pembelianUI.db.js — compatibility wrapper that loads canonical `pembelian-ui.db.js` */

(function () {
    if (typeof window === 'undefined') return;
    if (window.appPembelianUIDb) return;
    try {
        const s = document.createElement('script');
        s.src = 'js/ui/pembelian-ui.db.js';
        s.async = false;
        document.head.appendChild(s);
    } catch (e) { }
})();
/* pembelianUI.db.js — DB-centric UI wrapper for Pembelian
   Exposes: window.appPembelianUIDb
   Delegates to existing window.appPembelianUI or window.appPembelian if present.
*/
(function () {
    const delegate = (typeof window !== 'undefined' && (window.appPembelianUI || window.appPembelian)) || null;

    const api = {
        renderList: function () {
            if (delegate && typeof delegate.renderList === 'function') return delegate.renderList();
            console.warn('renderList: appPembelianUI not available');
        },
        openCreateModal: function (options) {
            if (delegate && typeof delegate.openCreateModal === 'function') return delegate.openCreateModal(options);
            console.warn('openCreateModal: appPembelianUI not available');
        },
        openDetail: function (id) {
            if (delegate && typeof delegate.openDetail === 'function') return delegate.openDetail(id);
            console.warn('openDetail: appPembelianUI not available');
        }
    };

    if (typeof window !== 'undefined') window.appPembelianUIDb = api;
})();
