/* filterPanels.js — small helper to standardize floating filter panel behavior */
(function () {
    // single shared backdrop for all filter panels
    let backdrop = null;
    const openPanels = new Set();

    function ensureBackdrop() {
        if (!backdrop) {
            backdrop = document.querySelector('.filter-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'filter-backdrop';
                backdrop.style.display = 'none';
                document.body.appendChild(backdrop);
            }
            backdrop.addEventListener('click', () => {
                // close all open panels when backdrop is clicked
                openPanels.forEach(ctrl => ctrl.close());
            });
        }
        return backdrop;
    }

    // Position panel under the button, similar to existing logic
    function positionPanel(button, panel) {
        try {
            panel.style.display = 'block';
            panel.style.visibility = 'hidden';
            panel.style.transform = 'none';
            const btnRect = button.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
            const margin = 8;
            let left = btnRect.left;
            if (left + panelRect.width + margin > vw) left = Math.max(margin, vw - panelRect.width - margin);
            let top = btnRect.bottom + 8;
            if (top + panelRect.height + margin > vh && (btnRect.top - panelRect.height - 8) > margin) {
                top = btnRect.top - panelRect.height - 8;
            }
            panel.style.left = Math.round(left) + 'px';
            panel.style.top = Math.round(top) + 'px';
            panel.style.visibility = 'visible';
        } catch (e) { /* ignore positioning errors */ }
    }

    // Register a panel/button pair. Returns controller { open, close, toggle }
    function register(buttonEl, panelEl) {
        if (!buttonEl || !panelEl) return null;
        // ensure panel attached to body
        if (panelEl.parentNode !== document.body) document.body.appendChild(panelEl);
        panelEl.style.display = 'none';
        panelEl.setAttribute('aria-hidden', 'true');

        const ctrl = {
            open() {
                // close other panels
                document.querySelectorAll('.filter-panel').forEach(p => { if (p !== panelEl) { p.style.display = 'none'; p.setAttribute('aria-hidden', 'true'); } });
                ensureBackdrop().style.display = 'block';
                buttonEl.setAttribute('aria-expanded', 'true');
                panelEl.setAttribute('aria-hidden', 'false');
                positionPanel(buttonEl, panelEl);
                openPanels.add(ctrl);
                const first = panelEl.querySelector('input, button'); if (first) first.focus();
            },
            close() {
                try { panelEl.style.display = 'none'; panelEl.setAttribute('aria-hidden', 'true'); buttonEl.setAttribute('aria-expanded', 'false'); } catch (e) { }
                try { ensureBackdrop().style.display = 'none'; } catch (e) { }
                // blur the trigger so it doesn't remain in :focus/:active visual state
                try { if (buttonEl && typeof buttonEl.blur === 'function') buttonEl.blur(); } catch (e) { }
                openPanels.delete(ctrl);
            },
            toggle() {
                const open = buttonEl.getAttribute('aria-expanded') === 'true';
                if (open) ctrl.close(); else ctrl.open();
            }
        };

        // button click toggles panel; stopPropagation so document handler won't immediately close it
        const onBtn = (ev) => { ev.stopPropagation(); ctrl.toggle(); };
        buttonEl.addEventListener('click', onBtn);

        // clicking inside panel should not close (document handler will check)
        panelEl.addEventListener('click', (ev) => { ev.stopPropagation(); });

        // document click closes this panel if click outside panel/button
        const docHandler = (ev) => {
            if (!panelEl || !buttonEl) return;
            if (ev.target.closest && (ev.target.closest('.filter-panel') === panelEl || ev.target.closest('#' + buttonEl.id))) return;
            ctrl.close();
        };
        document.addEventListener('click', docHandler);

        // ESC to close
        const escHandler = (ev) => { if (ev.key === 'Escape') ctrl.close(); };
        document.addEventListener('keydown', escHandler);

        // expose a cleanup method in case needed later
        ctrl._cleanup = () => {
            buttonEl.removeEventListener('click', onBtn);
            document.removeEventListener('click', docHandler);
            document.removeEventListener('keydown', escHandler);
        };

        return ctrl;
    }

    function closeAll() {
        // make a copy to avoid mutation during iteration
        Array.from(openPanels).forEach(ctrl => { try { ctrl.close(); } catch (e) { } });
    }

    window.filterPanels = { register, ensureBackdrop, closeAll };
})();
