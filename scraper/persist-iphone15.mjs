import { scrapeOfficialSpecs } from './official/index.js';
import scrapeMobileSpecs from './unofficial/mobile-specs.js';
import saveAndGetSpecs from './saveAndGetSpecs.js';

async function main() {
    const brand = 'Apple';
    const model = 'iPhone 15';
    console.log('Scraping official...');
    const official = await scrapeOfficialSpecs(brand, model).catch(e => { console.error('official error', e && e.message); return {}; });
    console.log('Scraping unofficial (mobile-specs)...');
    const unofficial = await scrapeMobileSpecs(brand, model).catch(e => { console.error('unofficial error', e && e.message); return {}; });

    console.log('Saving (or returning payload)...');
    const res = await saveAndGetSpecs(null, official, unofficial, { brand, model });
    console.log('Result from saveAndGetSpecs:');
    console.log(JSON.stringify(res, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });