import axios from 'axios';
import { load } from 'cheerio';

export default async function scrapeApple(brand, model) {
    try {
        // Search iPhone landing
        const q = encodeURIComponent(model);
        const searchUrl = `https://www.apple.com/id/search/?q=${q}`;
        const res = await axios.get(searchUrl, { timeout: 10000 });
        const $ = load(res.data);
        const link = $('a').filter((i, el) => $(el).attr('href') && $(el).attr('href').includes('/id/iphone/')).first().attr('href');
        if (!link) return {};
        const productUrl = link.startsWith('http') ? link : `https://www.apple.com${link}`;
        const prod = await axios.get(productUrl, { timeout: 10000 });
        const $$ = load(prod.data);
        const name = $$('h1').first().text().trim() || `${brand} ${model}`;
        const img = $$('meta[property="og:image"]').attr('content') || '';

        // Very conservative parse: gather sections by headings
        const detailSpec = [];
        $$('section').each((i, el) => {
            const title = $$(el).find('h2, h3').first().text().trim();
            if (!title) return;
            const specs = [];
            $$(el).find('li').each((j, li) => {
                const text = $$(li).text().trim();
                if (!text) return;
                const parts = text.split(':');
                const key = parts.shift().trim();
                const val = parts.join(':').trim();
                specs.push({ name: key, value: val });
            });
            if (specs.length) detailSpec.push({ category: title, specifications: specs });
        });

        return { name, img, detailSpec, quickSpec: [] };
    } catch (e) {
        return {};
    }
}
