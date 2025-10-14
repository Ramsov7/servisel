/* supplierUI.db.js — compatibility wrapper that loads canonical `supplier-ui.db.js` */

(function () {
    if (typeof window === 'undefined') return;
    if (window.appSupplierUIDb) return;
    try {
        const s = document.createElement('script');
        s.src = 'js/ui/supplier-ui.db.js';
        s.async = false;
        document.head.appendChild(s);
    } catch (e) { }
})();
/* supplierUI.db.js — DB-centric UI wrapper for Supplier
   Exposes: window.appSupplierUIDb
   Delegates to existing window.appSupplierUI or window.appSupplier if present.
*/
(function () {
    const delegate = (typeof window !== 'undefined' && (window.appSupplierUI || window.appSupplier)) || null;

    const api = {
        renderList: function () {
            if (delegate && typeof delegate.renderList === 'function') return delegate.renderList();
            console.warn('renderList: appSupplierUI not available');
        },
        openCreateModal: function (opts) {
            if (delegate && typeof delegate.openCreateModal === 'function') return delegate.openCreateModal(opts);
            console.warn('openCreateModal: appSupplierUI not available');
        },
        getById: function (id) {
            if (delegate && typeof delegate.getById === 'function') return delegate.getById(id);
            console.warn('getById: appSupplierUI not available');
            return null;
        }
    };

    if (typeof window !== 'undefined') window.appSupplierUIDb = api;
})();
