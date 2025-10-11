import axios from 'axios';
import { load } from 'cheerio';

export default async function scrapeDevicespecs(brand, model) {
    try {
        const q = encodeURIComponent((brand + ' ' + model).trim());
        const url = `https://www.devicespecifications.com/en/search?query=${q}`;
        const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = load(res.data);
        // find first result link
        const first = $('a[href*="/en/model/"]').first();
        const href = first.attr('href');
        if (!href) return {};
        const pageUrl = href.startsWith('http') ? href : `https://www.devicespecifications.com${href}`;
        const page = await axios.get(pageUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $$ = load(page.data);
        const name = $$('.model-title').first().text().trim() || `${brand} ${model}`;
        const img = $$('.model-image img').first().attr('src') || '';
        const detailSpec = [];
        $$('.table-specs').each((i, table) => {
            const cat = $$(table).prevAll('h2').first().text().trim() || 'Specs';
            const specs = [];
            $$(table).find('tr').each((j, tr) => {
                const key = $$(tr).find('th').text().trim();
                const val = $$(tr).find('td').text().trim();
                if (key) specs.push({ name: key, value: val });
            });
            if (specs.length) detailSpec.push({ category: cat, specifications: specs });
        });
        return { name, img, detailSpec, quickSpec: [] };
    } catch (e) {
        return {};
    }
}
