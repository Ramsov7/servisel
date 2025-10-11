// theme-init.js — apply theme synchronously before CSS loads
(function () {
    try {
        var key = 'app.theme';
        var stored = localStorage.getItem(key);
        var theme = 'light';
        if (!stored || stored === 'system') {
            theme =
                window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light';
        } else {
            theme = stored;
        }
        document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
        /* ignore */
    }
})();
