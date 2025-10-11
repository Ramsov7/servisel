import axios from 'axios';
import { load } from 'cheerio';
import { createRequire } from 'module';

function normalizeCategoryName(n) {
    if (!n) return n;
    return n.replace(/\s+/g, ' ').trim();
}

async function scrapeViaHttp(brand, model) {
    try {
        const q = encodeURIComponent((brand + ' ' + model).trim());
        const searchUrl = `https://www.gsmarena.com/res.php3?sSearch=${q}`;
        const res = await axios.get(searchUrl, { timeout: 10000 });
        const $ = load(res.data);
        const first = $('div.makers a').first();
        const href = first.attr('href');
        if (!href) return {};
        const url = `https://www.gsmarena.com/${href}`;
        const page = await axios.get(url, { timeout: 10000 });
        const $$ = load(page.data);

        const name = $$('h1.specs-phone-name-title').text().trim();
        const img = $$('.specs-photo-main img').attr('src') || '';
        // Build detailSpec using multiple strategies for robustness
        const detailSpec = [];

        // Strategy A: article-info-piece groups (newer layout)
        $$('.article-info-piece').each((i, piece) => {
            const cat = $$(piece).find('h2').text().trim();
            const specs = [];
            $$(piece).find('table tr').each((j, tr) => {
                const tds = $$(tr).find('td');
                const key = $$(tds[0]).text().trim();
                const val = $$(tds[1]).text().trim();
                if (key) specs.push({ name: key, value: val });
            });
            if (specs.length) detailSpec.push({ category: normalizeCategoryName(cat), specifications: specs });
        });

        // Strategy B: fallback to #specs-list table scanning
        if (detailSpec.length === 0) {
            $$('#specs-list table').each((i, table) => {
                // try to find a heading for this table
                let cat = $$(table).prevAll('h2').first().text().trim();
                if (!cat) {
                    // sometimes the first th in table is the category
                    const firstTh = $$(table).find('th').first().text().trim();
                    if (firstTh) cat = firstTh;
                }
                if (!cat) cat = 'Misc';
                const specs = [];
                $$(table).find('tr').each((j, tr) => {
                    const key = $$(tr).find('th').text().trim() || $$(tr).find('td.ttl').text().trim() || $$(tr).find('td').first().text().trim();
                    const val = $$(tr).find('td.nfo').text().trim() || $$(tr).find('td').last().text().trim();
                    if (key) specs.push({ name: key, value: val });
                });
                if (specs.length) detailSpec.push({ category: normalizeCategoryName(cat), specifications: specs });
            });
        }

        // Strategy C: generic scan for tables when previous strategies miss
        if (detailSpec.length === 0) {
            $$('.article-info tr').each((i, tr) => {
                const key = $$(tr).find('th').text().trim();
                const val = $$(tr).find('td').text().trim();
                if (key) {
                    // put into Misc
                    let misc = detailSpec.find(d => d.category === 'Misc');
                    if (!misc) { misc = { category: 'Misc', specifications: [] }; detailSpec.push(misc); }
                    misc.specifications.push({ name: key, value: val });
                }
            });
        }

        // Normalize multiple values: ensure string with \n for multiple lines already handled above
        // Build quickSpec conservatively
        const quickSpec = [];
        const quickMap = {};
        detailSpec.forEach(cat => {
            (cat.specifications || []).forEach(s => {
                const k = (s.name || '').toLowerCase();
                const v = s.value || '';
                if (k.includes('display') && !quickMap['Display']) quickMap['Display'] = v;
                if ((k.includes('resolution') || k.includes('pixel')) && !quickMap['DisplayResolution']) quickMap['DisplayResolution'] = v;
                if (k.includes('ram') && !quickMap['RAM']) quickMap['RAM'] = v;
                if (k.includes('battery') && !quickMap['Battery']) quickMap['Battery'] = v;
                if ((k.includes('chipset') || k.includes('soc') || k.includes('cpu')) && !quickMap['Chipset']) quickMap['Chipset'] = v;
                if ((k.includes('camera') || k.includes('megapixel') || k.includes('mp')) && !quickMap['Camera']) quickMap['Camera'] = v;
            });
        });
        quickSpec.push({ name: 'Display size', value: quickMap['Display'] || '' });
        quickSpec.push({ name: 'Display resolution', value: quickMap['DisplayResolution'] || '' });
        quickSpec.push({ name: 'Camera pixels', value: quickMap['Camera'] || '' });
        quickSpec.push({ name: 'Video pixels', value: '' });
        quickSpec.push({ name: 'RAM size', value: quickMap['RAM'] || '' });
        quickSpec.push({ name: 'Chipset', value: quickMap['Chipset'] || '' });
        quickSpec.push({ name: 'Battery size', value: quickMap['Battery'] || '' });
        quickSpec.push({ name: 'Battery type', value: '' });

        return { name, img, detailSpec, quickSpec };
    } catch (e) {
        return {};
    }
}

export default async function scrapeGsmarena(brand, model) {
    // Try to use local gsmarena-api-master if available (faster/more robust)
    try {
        const require = createRequire(import.meta.url);
        const local = require('../../gsmarena-api-master');
        if (local && local.search && typeof local.search.search === 'function') {
            const query = `${brand} ${model}`.trim();
            const results = await local.search.search(query);
            if (Array.isArray(results) && results.length) {
                const first = results[0];
                // first.id in local module is slug without .php
                let id = first.id || '';
                // If id includes .php trim it
                id = id.replace(/\.php$/i, '');
                const url = `https://www.gsmarena.com/${id}.php`;
                try {
                    const page = await axios.get(url, { timeout: 10000 });
                    const $$ = load(page.data);
                    const name = $$('h1.specs-phone-name-title').text().trim();
                    const img = $$('.specs-photo-main img').attr('src') || '';
                    const detailSpec = [];
                    $$('.article-info-piece').each((i, piece) => {
                        const cat = $$(piece).find('h2').text().trim();
                        const specs = [];
                        $$(piece).find('table tr').each((j, tr) => {
                            const tds = $$(tr).find('td');
                            const key = $$(tds[0]).text().trim();
                            const val = $$(tds[1]).text().trim();
                            if (key) specs.push({ name: key, value: val });
                        });
                        if (specs.length) detailSpec.push({ category: normalizeCategoryName(cat), specifications: specs });
                    });
                    return { name, img, detailSpec, quickSpec: [] };
                } catch (e) {
                    // fallback to http scraping
                    return await scrapeViaHttp(brand, model);
                }
            }
        }
    } catch (e) {
        // local module not available or failed: fallback to direct HTTP scraping
    }

    return await scrapeViaHttp(brand, model);
}
