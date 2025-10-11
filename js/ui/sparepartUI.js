/* sparepartUI.js — wrapper that exposes DB-centric UI names for sparepart
   Re-uses existing itemsUI implementation when available, and exposes
   `window.appSparepartUI` while keeping `window.appItemsUI` for legacy.
*/

(function () {
    // If the full items UI exists, reuse its functions; otherwise provide minimal stubs.
    const impl = (typeof window !== 'undefined' && window.appItemsUI) ? window.appItemsUI : null;

    const exposed = {
        loadAndRenderSparepart: impl && impl.loadAndRenderItems ? impl.loadAndRenderItems : async function () { throw new Error('items UI not available'); },
        initSparepartUI: impl && impl.initItemsUI ? impl.initItemsUI : function () { /* no-op */ },
        applyFilters: impl && impl.applyFilters ? impl.applyFilters : function () { /* no-op */ },
        renderSparepartList: impl && impl.renderItems ? impl.renderItems : function () { /* no-op */ }
    };

    if (typeof window !== 'undefined') {
        window.appSparepartUI = exposed;
        // ensure legacy alias stays available
        if (!window.appItemsUI && impl) window.appItemsUI = impl;
    }

    return exposed;
})();
