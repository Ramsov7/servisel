/* pembelian-ui.db.js — kebab-case copy of pembelianUI.db.js */
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
