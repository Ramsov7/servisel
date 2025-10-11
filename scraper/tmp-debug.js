import { scrapeOfficialSpecs } from './official/index.js';
import { scrapeUnofficialSpecs } from './unofficial/index.js';

const args = process.argv.slice(2);
const brand = args[0] || 'Samsung';
const model = args.slice(1).join(' ') || 'Galaxy A34';

(async () => {
    console.log('DEBUG: running scrapers for', brand, model);
    try {
        const off = await scrapeOfficialSpecs(brand, model).catch(e => ({ error: e && e.message }));
        console.log('OFFICIAL RESULT:', JSON.stringify(off, null, 2));
    } catch (e) {
        console.error('OFFICIAL ERROR', e && e.stack);
    }
    try {
        const un = await scrapeUnofficialSpecs(brand, model).catch(e => ({ error: e && e.message }));
        console.log('UNOFFICIAL RESULT:', JSON.stringify(un, null, 2));
    } catch (e) {
        console.error('UNOFFICIAL ERROR', e && e.stack);
    }
})();
