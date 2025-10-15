/* main.js — app bootstrapper wiring modules together */

(function () {
    async function initApp() {
        try { console.log('[main] initApp starting, html.classes=', document.documentElement.className); } catch (e) { }
        try {
            // initialize UI modules
            if (window.appNavigation) {
                window.appNavigation.initNavigation();
                // ensure notch aligns after navigation setup
                if (window.appFAB && typeof window.appFAB.positionNavNotch === 'function') window.appFAB.positionNavNotch();
            }
            if (window.appModal) window.appModal.initModal();
            if (window.appTheme) window.appTheme.initThemeControls();
            // read and apply stored app mode (default: 'bengkel')
            try {
                const currentMode = localStorage.getItem('appMode') || 'bengkel';
                window.appMode = currentMode;
                // pre-check radio in settings modal if present
                const modeRad = document.querySelector(`#settings-modal input[name=\"appMode\"][value=\"${currentMode}\"]`);
                if (modeRad) modeRad.checked = true;
                // expose getter as well
                window.getAppMode = window.getAppMode || function () { return window.appMode || 'bengkel'; };
            } catch (e) { /* ignore */ }
            if (window.appItemsUI) window.appItemsUI.initItemsUI();

            // load data
            // Guard: wait briefly for appItemsUI and Supabase client readiness to avoid race conditions
            async function waitFor(predicate, timeout = 2000, interval = 50) {
                const start = Date.now();
                while (!predicate()) {
                    if (Date.now() - start > timeout) return false;
                    await new Promise(r => setTimeout(r, interval));
                }
                return true;
            }

            const ready = await waitFor(() => {
                const hasUI = !!(window.appItemsUI && typeof window.appItemsUI.loadAndRenderItems === 'function');
                // Ensure Supabase client is actually usable — not just that a helper exists.
                let client = null;
                try {
                    if (typeof getSupabase === 'function') {
                        try { client = getSupabase(); } catch (e) { client = (window.supabase && typeof window.supabase.from === 'function') ? window.supabase : null; }
                    } else if (window.supabase && typeof window.supabase.from === 'function') {
                        client = window.supabase;
                    }
                } catch (e) { client = null; }
                const hasSup = !!client;
                return hasUI && hasSup;
            }, 2500, 60);

            if (ready) {
                try {
                    await window.appItemsUI.loadAndRenderItems();
                } catch (e) {
                    console.error('Initial loadAndRenderItems failed', e);
                }
                // Now that Supabase client is available, initialize modules that perform DB queries on init
                try {
                    if (window.appJasaUI && typeof window.appJasaUI.init === 'function') await window.appJasaUI.init();
                } catch (e) { console.error('appJasaUI.init failed', e); }
                try {
                    if (window.appUnitsUI && typeof window.appUnitsUI.init === 'function') await window.appUnitsUI.init();
                } catch (e) { console.error('appUnitsUI.init failed', e); }
            } else {
                console.warn('Initial items load skipped: appItemsUI or Supabase client not ready after wait.');
            }
            // initialize FAB quick-actions (if present)
            if (window.appFAB && typeof window.appFAB.initFAB === 'function') {
                window.appFAB.initFAB();
                if (typeof window.appFAB.positionNavNotch === 'function') window.appFAB.positionNavNotch();
            }
        } catch (err) {
            console.error('initApp failed', err);
        }
        // wait for icons and navigation readiness signalled on <html>
        const root = document.documentElement;
        const waitForReady = () => new Promise((resolve) => {
            const max = 2000; // fallback timeout
            const start = Date.now();
            function check() {
                if (root.classList.contains('icons-ready') && root.classList.contains('app-ready')) return resolve(true);
                if (Date.now() - start > max) return resolve(false);
                requestAnimationFrame(check);
            }
            check();
        });

        await waitForReady();
        // hide overlay
        try {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.setAttribute('aria-hidden', 'true');
        } catch (e) { /* ignore */ }

        // Ensure there's only one .add-btn in the DOM to avoid duplicates (some caches or dev edits
        // may accidentally leave duplicates). Prefer the button inside .select-row (left of filters).
        try {
            const buttons = Array.from(document.querySelectorAll('.add-btn'));
            if (buttons.length > 1) {
                // find preferred: inside .select-row
                let preferred = buttons.find(b => b.closest && b.closest('.select-row')) || buttons[0];
                buttons.forEach(b => { if (b !== preferred && b.parentNode) b.parentNode.removeChild(b); });
            }
        } catch (e) { /* ignore */ }

        // Wire Backup / Ekspor button in settings modal (simple JSON export)
        try {
            const backupBtn = document.getElementById('backup-export');
            if (backupBtn) {
                backupBtn.addEventListener('click', async () => {
                    backupBtn.disabled = true;
                    backupBtn.textContent = 'Mengekspor…';
                    try {
                        const [items, jasa, expenses] = await Promise.all([
                            window.itemsApi ? window.itemsApi.listItems?.() : itemsApi.listItems(),
                            jasaApi.listJasa(),
                            expensesApi.listExpenses()
                        ]);
                        const payload = { exported_at: new Date().toISOString(), items, jasa, expenses };
                        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `servisel-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                    } catch (e) {
                        console.error('Export failed', e);
                        alert('Gagal mengekspor data: ' + (e.message || e));
                    } finally {
                        backupBtn.disabled = false;
                        backupBtn.textContent = 'Backup / Ekspor';
                    }
                });
            }
        } catch (e) { /* ignore */ }
    }

    // wait for DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
