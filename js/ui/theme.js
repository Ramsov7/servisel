/* theme.js — theme selection, persistence and applying */

(function () {
    const THEME_KEY = 'app.theme';

    function applyTheme(theme) {
        const root = document.documentElement;
        if (!theme || theme === 'system') {
            // follow system
            const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.setAttribute('data-theme', prefers);
            localStorage.removeItem(THEME_KEY);
            return;
        }
        root.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }

    function initThemeControls() {
        const radios = document.querySelectorAll('input[name="theme"]');
        const stored = localStorage.getItem(THEME_KEY) || 'system';
        // set radio
        radios.forEach(r => { if (r.value === stored) r.checked = true; r.addEventListener('change', () => applyTheme(r.value)); });

        // apply at load
        if (stored === 'system') applyTheme('system'); else applyTheme(stored);

        // react to system changes when user selected 'system'
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                const current = localStorage.getItem(THEME_KEY) || 'system';
                if (current === 'system') applyTheme('system');
            });
        }
    }

    // keep backward-compatible global functions used by legacy script
    window.applyTheme = applyTheme;
    window.initTheme = function () { initThemeControls(); };

    window.appTheme = { applyTheme, initThemeControls };
})();
