/* jasaUI.db.js — DB-centric wrapper for jasa UI
   Exposes window.appJasaUIDb and keeps window.appJasaUI for compatibility.
*/

(function () {
    const impl = (typeof window !== 'undefined' && window.appJasaUI) ? window.appJasaUI : null;

    const exposed = {
        renderList: impl && impl.renderList ? impl.renderList : async function () { throw new Error('Jasa UI not available'); },
        init: impl && impl.init ? impl.init : function () { /* noop */ }
    };

    if (typeof window !== 'undefined') {
        window.appJasaUIDb = exposed;
        if (!window.appJasaUI && impl) window.appJasaUI = impl;
    }

    return exposed;
})();
