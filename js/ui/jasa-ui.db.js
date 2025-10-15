/* jasa-ui.db.js — kebab-case copy of jasaUI.db.js */
(function () {
    const delegate = (typeof window !== 'undefined' && (window.appJasaUI || window.appJasa)) || null;

    const api = {
        renderList: function () {
            if (delegate && typeof delegate.renderList === 'function') return delegate.renderList();
            console.warn('renderList: appJasaUI not available');
        }
    };

    if (typeof window !== 'undefined') window.appJasaUIDb = api;
})();
