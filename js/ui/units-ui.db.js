/* units-ui.db.js — kebab-case copy of unitsUI.db.js */
(function () {
    const impl = (typeof window !== 'undefined' && window.appUnitsUI) ? window.appUnitsUI : null;
    const exposed = {
        init: impl && impl.init ? impl.init : function () { /* noop */ },
        renderList: impl && impl.renderList ? impl.renderList : async function () { throw new Error('units UI not available'); },
        openCreateUnitModal: impl && impl.openCreateUnitModal ? impl.openCreateUnitModal : function () { /* noop */ },
        insertUnit: impl && impl.insertUnit ? impl.insertUnit : async function () { throw new Error('insertUnit not available'); }
    };

    if (typeof window !== 'undefined') {
        window.appUnitsUIDb = exposed;
        if (!window.appUnitsUI && impl) window.appUnitsUI = impl;
    }

    return exposed;
})();
