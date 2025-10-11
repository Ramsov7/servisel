import { scrapeOfficialSpecs } from './official/index.js';
import { scrapeUnofficialSpecs } from './unofficial/index.js';
import { saveAndGetSpecs } from './saveAndGetSpecs.js';

const [, , brand, ...modelParts] = process.argv;
const model = modelParts.join(' ') || 'Galaxy A34';

(async () => {
    try {
        console.log('RUN: scraping official...');
        const official = await scrapeOfficialSpecs(brand, model).catch(e => { console.error('OFF ERR', e && e.message); return {}; });
        console.log('RUN: scraping unofficial...');
        const unofficial = await scrapeUnofficialSpecs(brand, model).catch(e => { console.error('UNOFF ERR', e && e.message); return {}; });

        console.log('RUN: calling saveAndGetSpecs...');
        const res = await saveAndGetSpecs(null, official, unofficial, { brand, model });
        console.log('RESULT:', JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('FATAL', e && e.stack);
    }
})();
