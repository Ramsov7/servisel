import puppeteer from 'puppeteer';

export default async function scrapeApplePuppeteer(brand, model) {
    let browser;
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        // More browser-like fingerprint
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });
        const q = encodeURIComponent(model);
        const searchUrl = `https://www.apple.com/id/search/?q=${q}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        // find link to iphone product: be flexible (href or link text)
        let link = await page.$$eval('a', els => {
            const candidates = [];
            for (const a of els) {
                try {
                    const href = a.href || '';
                    const text = (a.innerText || '').toLowerCase();
                    if (href.toLowerCase().includes('/iphone') || text.includes('iphone')) candidates.push({ href, text });
                } catch (e) { /* ignore */ }
            }
            return candidates.slice(0, 50);
        });
        if (process.env.VERBOSE_SCRAPER) console.log('DEBUG: initial iphone anchors:', link);
        // If returned array, pick first href if any
        if (Array.isArray(link) && link.length) link = link[0].href; else link = null;

        // fallback: try global iphone listing
        if (!link) {
            try {
                await page.goto('https://www.apple.com/iphone/', { waitUntil: 'networkidle2', timeout: 20000 });
                let cand = await page.$$eval('a', els => {
                    const c = [];
                    for (const a of els) {
                        try {
                            const href = a.href || '';
                            const text = (a.innerText || '').toLowerCase();
                            if (href.toLowerCase().includes('/iphone') || text.includes('iphone')) c.push({ href, text });
                        } catch (e) { }
                    }
                    return c.slice(0, 50);
                });
                if (process.env.VERBOSE_SCRAPER) console.log('DEBUG: iphone listing anchors at /iphone:', cand);
                if (Array.isArray(cand) && cand.length) link = cand[0].href;
            } catch (e) {
                // ignore
            }
        }

        if (!link) {
            // last resort: try root site and search for model words
            try {
                await page.goto('https://www.apple.com/', { waitUntil: 'networkidle2', timeout: 20000 });
                const modelLower = model.toLowerCase();
                let cand = await page.$$eval('a', (els, modelLower) => {
                    const c = [];
                    for (const a of els) {
                        try {
                            const href = a.href || '';
                            const text = (a.innerText || '').toLowerCase();
                            if ((href.toLowerCase().includes('iphone') || text.includes('iphone')) && text.includes(modelLower.split(' ')[0])) c.push({ href, text });
                        } catch (e) { }
                    }
                    return c.slice(0, 50);
                }, modelLower);
                if (process.env.VERBOSE_SCRAPER) console.log('DEBUG: root anchors matching model:', cand);
                if (Array.isArray(cand) && cand.length) link = cand[0].href;
            } catch (e) { }
        }

        if (!link) {
            // if no explicit product link found, try slug-based direct URL attempts for common patterns
            const slugify = (s) => s.toString().toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
            const slug = slugify(model.replace(/iphone\s*/i, '')) || slugify(model);
            const directCandidates = [
                `https://www.apple.com/id/iphone-${slug}/`,
                `https://www.apple.com/iphone-${slug}/`,
                `https://www.apple.com/id/iphone/${slug}/`,
                `https://www.apple.com/iphone/${slug}/`,
                `https://www.apple.com/id/iphone/${slug}-/`,
            ];
            if (process.env.VERBOSE_SCRAPER) console.log('DEBUG: trying direct candidates', directCandidates);
            for (const c of directCandidates) {
                try {
                    await page.goto(c, { waitUntil: 'networkidle2', timeout: 15000 });
                    const ok = await page.$eval('h1, meta[property="og:title"]', () => true).catch(() => false);
                    if (ok) { link = c; break; }
                } catch (err) { /* ignore */ }
            }
        } else {
            await page.goto(link, { waitUntil: 'networkidle2', timeout: 20000 });
        }
        // Extract name and og:image
        // Try to extract JSON-LD product data if present
        const jsonLd = await page.$$eval('script[type="application/ld+json"]', els => els.map(s => s.innerText));
        let name = '';
        let img = '';
        if (jsonLd && jsonLd.length) {
            for (const txt of jsonLd) {
                try {
                    const j = JSON.parse(txt);
                    if (j && (j.name || j['@type'])) {
                        name = name || (j.name || '');
                        if (j.image) img = img || (Array.isArray(j.image) ? j.image[0] : j.image);
                    }
                    // handle nested itemListElement
                    if (j && j.itemListElement && Array.isArray(j.itemListElement)) {
                        for (const item of j.itemListElement) {
                            if (item && item.item && item.item.name) {
                                name = name || item.item.name;
                            }
                        }
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        }

        if (!name) name = await page.$eval('h1', h => h && h.innerText ? h.innerText.trim() : '').catch(() => '');
        if (!img) img = await page.$eval('meta[property="og:image"]', m => m && m.content ? m.content : '').catch(() => '');

        // Extract some sections: find headings and following list items
        const detailSpec = await page.evaluate(() => {
            const out = [];
            // Try sections first
            document.querySelectorAll('section').forEach(sec => {
                const h = sec.querySelector('h2, h3');
                const title = h ? h.innerText.trim() : null;
                const specs = [];
                sec.querySelectorAll('li').forEach(li => {
                    const text = li.innerText.trim();
                    if (!text) return;
                    const parts = text.split(':');
                    const key = parts.shift().trim();
                    const val = parts.join(':').trim();
                    specs.push({ name: key, value: val });
                });
                if (title && specs.length) out.push({ category: title, specifications: specs });
            });
            // Fallback: try h2/h3 headings and their following paragraphs
            if (!out.length) {
                document.querySelectorAll('h2, h3').forEach(h => {
                    const title = h.innerText.trim();
                    const specs = [];
                    let el = h.nextElementSibling;
                    while (el && (el.tagName.toLowerCase() === 'p' || el.tagName.toLowerCase() === 'div')) {
                        const text = el.innerText.trim();
                        if (text) specs.push({ name: text.split('\n')[0].slice(0, 60), value: text });
                        el = el.nextElementSibling;
                        if (specs.length >= 5) break;
                    }
                    if (specs.length) out.push({ category: title, specifications: specs });
                });
            }
            return out;
        });

        await browser.close();
        return { name, img, detailSpec, quickSpec: [] };
    } catch (e) {
        if (browser) try { await browser.close(); } catch (er) { }
        return {};
    }
}
