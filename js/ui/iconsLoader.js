// iconsLoader.js
// Fetch external SVG files and replace <img src="assets/icons/..."> with inline <svg> markup
// This restores the ability to style icons with CSS (e.g. `fill: currentColor`).

document.addEventListener('DOMContentLoaded', () => {
    const imgs = Array.from(document.querySelectorAll('img[src^="assets/icons/"]'));
    const root = document.documentElement;
    if (!imgs.length) {
        // mark ready if nothing to do
        root.classList.add('icons-ready');
        return;
    }

    const cache = new Map();
    const parser = new DOMParser();

    const promises = imgs.map((img) => {
        const src = img.getAttribute('src');
        if (!src) return Promise.resolve();

        const replaceWithSvg = (svg) => {
            const svgClone = svg.cloneNode(true);
            // Transfer classes and id from the <img> to the <svg>
            const imgClass = img.getAttribute('class');
            if (imgClass) {
                imgClass.split(/\s+/).forEach((c) => { if (c) svgClone.classList.add(c); });
            }
            svgClone.classList.add('inline-svg');
            if (img.id) svgClone.id = img.id;

            // Accessibility: preserve alt as aria-label and title
            const alt = img.getAttribute('alt');
            if (alt) {
                svgClone.setAttribute('role', 'img');
                svgClone.setAttribute('aria-label', alt);
                if (!svgClone.querySelector('title')) {
                    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                    title.textContent = alt;
                    svgClone.insertBefore(title, svgClone.firstChild);
                }
            } else {
                svgClone.setAttribute('aria-hidden', 'true');
            }

            // Allow CSS sizing by removing explicit width/height attributes
            svgClone.removeAttribute('width');
            svgClone.removeAttribute('height');

            // Replace img with inline svg
            if (img.parentNode) img.parentNode.replaceChild(svgClone, img);
        };

        if (cache.has(src)) {
            replaceWithSvg(cache.get(src));
            return Promise.resolve();
        }

        return fetch(src).then((res) => {
            if (!res.ok) throw new Error('Failed to fetch: ' + src);
            return res.text();
        }).then((text) => {
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const svg = doc.querySelector('svg');
            if (!svg) throw new Error('No <svg> found in ' + src);
            // Ensure xmlns is present
            if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            // If viewBox is missing but width/height present, set a viewBox so scaling works when inlined
            if (!svg.getAttribute('viewBox')) {
                const w = svg.getAttribute('width');
                const h = svg.getAttribute('height');
                // try to parse numeric values
                const wn = w ? parseFloat(w) : NaN;
                const hn = h ? parseFloat(h) : NaN;
                if (!isNaN(wn) && !isNaN(hn)) {
                    svg.setAttribute('viewBox', `0 0 ${wn} ${hn}`);
                }
            }

            // Remove hardcoded fill attributes on child elements so the root fill (e.g. currentColor) applies
            try {
                const descendants = svg.querySelectorAll('[fill]');
                descendants.forEach((el) => {
                    const fv = el.getAttribute('fill');
                    // If fill is a hardcoded color (not 'currentColor' or 'none'), remove it so CSS can control color
                    if (fv && fv.toLowerCase() !== 'currentcolor' && fv.toLowerCase() !== 'none') {
                        el.removeAttribute('fill');
                    }
                });
            } catch (e) {
                // ignore if SVG parsing has unexpected structure
            }

            // Cache the (possibly modified) svg element for reuse
            cache.set(src, svg);
            replaceWithSvg(svg);
        }).catch((err) => {
            // If fetching fails, leave the <img> in place and log error
            // eslint-disable-next-line no-console
            console.error('iconsLoader: could not inline', src, err);
        });
    });

    // When all inlining attempts finish (success or failure), mark icons as ready so fallbacks show
    Promise.all(promises).finally(() => {
        root.classList.add('icons-ready');
    });
});
