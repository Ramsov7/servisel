/* modal.js — settings modal open/close and small utilities */

(function () {
    const settingsModal = document.getElementById('settings-modal');
    const headerSettingsBtn = document.querySelector('header .notif-btn');
    const modalClose = settingsModal ? settingsModal.querySelector('.modal-close') : null;

    function openSettings() {
        if (!settingsModal) return;
        settingsModal.setAttribute('aria-hidden', 'false');
        // mark page as modal-open so global CSS blurs the app chrome
        try { document.body.classList.add('modal-open'); } catch (e) { /* ignore */ }
        const closeBtn = settingsModal.querySelector('.modal-close');
        if (headerSettingsBtn) headerSettingsBtn.setAttribute('aria-expanded', 'true');
        if (closeBtn) closeBtn.focus();
    }
    function closeSettings() {
        if (!settingsModal) return;
        settingsModal.setAttribute('aria-hidden', 'true');
        try { document.body.classList.remove('modal-open'); } catch (e) { /* ignore */ }
        if (headerSettingsBtn) headerSettingsBtn.setAttribute('aria-expanded', 'false');
    }

    function initModal() {
        if (headerSettingsBtn && settingsModal) {
            headerSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (settingsModal.getAttribute('aria-hidden') === 'false') closeSettings();
                else openSettings();
            });
        }

        if (modalClose) modalClose.addEventListener('click', closeSettings);

        // Save settings button (if present) should apply the theme and close the modal
        const saveBtn = settingsModal ? settingsModal.querySelector('#save-settings') : null;
        if (saveBtn) {
            saveBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                // Apply theme selection if theme module exposes applyTheme function
                try {
                    const selected = settingsModal.querySelector('input[name="theme"]:checked');
                    if (selected && window.appTheme && typeof window.appTheme.applyTheme === 'function') {
                        window.appTheme.applyTheme(selected.value);
                    }
                    // save app mode (bengkel | toko) - toko is disabled for now
                    try {
                        const modeRad = settingsModal.querySelector('input[name="appMode"]:checked');
                        const mode = modeRad ? modeRad.value : 'bengkel';
                        localStorage.setItem('appMode', mode);
                        // expose current mode on window for legacy code
                        window.appMode = mode;
                        try { window.dispatchEvent(new CustomEvent('appModeChanged', { detail: { mode } })); } catch (e) { /* ignore */ }
                    } catch (e) { /* ignore mode save errors */ }
                } catch (e) {
                    /* ignore */
                }
                closeSettings();
            });
        }

        if (settingsModal) settingsModal.addEventListener('click', (ev) => {
            const action = ev.target.closest('[data-action]');
            if (action && action.dataset.action === 'close') closeSettings();
            if (ev.target === settingsModal) closeSettings();
        });

        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') closeSettings();
        });
    }

    window.appModal = { initModal, openSettings, closeSettings };
    // expose small helpers for accessing mode
    window.getAppMode = function () { return localStorage.getItem('appMode') || 'bengkel'; };
})();
