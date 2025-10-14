/* penggunaUI.db.js — compatibility wrapper that loads canonical `pengguna-ui.db.js` */

(function () {
    if (typeof window === 'undefined') return;
    if (window.appPenggunaUIDb) return;
    try {
        const s = document.createElement('script');
        s.src = 'js/ui/pengguna-ui.db.js';
        s.async = false;
        document.head.appendChild(s);
    } catch (e) { }
})();
/* penggunaUI.db.js — DB-centric UI wrapper for Pengguna
   Exposes: window.appPenggunaUIDb
   Delegates to existing window.appPenggunaUI or window.appPengguna if present.
*/
(function () {
    const delegate = (typeof window !== 'undefined' && (window.appPenggunaUI || window.appPengguna)) || null;

    const api = {
        renderList: function () {
            if (delegate && typeof delegate.renderList === 'function') return delegate.renderList();
            console.warn('renderList: appPenggunaUI not available');
        },
        openCreateModal: function (opts) {
            if (delegate && typeof delegate.openCreateModal === 'function') return delegate.openCreateModal(opts);
            console.warn('openCreateModal: appPenggunaUI not available');
        },
        getById: function (id) {
            if (delegate && typeof delegate.getById === 'function') return delegate.getById(id);
            console.warn('getById: appPenggunaUI not available');
            return null;
        }
    };

    if (typeof window !== 'undefined') window.appPenggunaUIDb = api;
})();
