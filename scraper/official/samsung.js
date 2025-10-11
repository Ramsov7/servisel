import axios from 'axios';
import { load } from 'cheerio';

// This is a simple parser for Samsung official site product pages.
// It is intentionally conservative and returns minimal fields so merge logic can work.
export default async function scrapeSamsung(brand, model) {
    try {
        const q = encodeURIComponent(model);
        const listUrl = `https://www.samsung.com/id/search/?q=${q}`;
        const res = await axios.get(listUrl, { timeout: 10000 });
        const $ = load(res.data);
        // Find first product link
        const link = $('a[href*="/smartphones/"]').first().attr('href');
        if (!link) return {};
        const productUrl = link.startsWith('http') ? link : `https://www.samsung.com${link}`;
        const prod = await axios.get(productUrl, { timeout: 10000 });
        const $$ = load(prod.data);
        const name = $$('h1').first().text().trim() || `${brand} ${model}`;
        const img = $$('meta[property="og:image"]').attr('content') || '';

        // Attempt to parse spec sections by heading and definition lists
        const detailSpec = [];
        $$('section').each((i, el) => {
            const title = $$(el).find('h2, h3').first().text().trim();
            if (!title) return;
            const specs = [];
            $$(el).find('li').each((j, li) => {
                const text = $$(li).text().trim();
                if (!text) return;
                const parts = text.split(':');
                const name = parts.shift().trim();
                const value = parts.join(':').trim();
                specs.push({ name, value });
            });
            if (specs.length) detailSpec.push({ category: title, specifications: specs });
        });

        return { name, img, detailSpec, quickSpec: [] };
    } catch (e) {
        return {};
    }
}
