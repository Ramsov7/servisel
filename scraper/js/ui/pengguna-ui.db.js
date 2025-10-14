/* pengguna-ui.db.js — kebab-case copy of penggunaUI.db.js */
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
