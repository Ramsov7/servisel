import { scrapeOfficialSpecs } from './official/index.js';
import scrapeMobileSpecs from './unofficial/mobile-specs.js';
import { mergeSpecs } from './helpers/mergeSpecs.js';
import { formatQuickSpecFromDetail } from './helpers/formatQuickSpec.js';

async function run() {
    const brand = 'Apple';
    const model = 'iPhone 15';
    console.log('Running official scraper...');
    const official = await scrapeOfficialSpecs(brand, model);
    console.log('Official result keys:', Object.keys(official || {}));

    console.log('Running unofficial (mobile-specs) scraper...');
    const unofficial = await scrapeMobileSpecs(brand, model);
    console.log('Unofficial result keys:', Object.keys(unofficial || {}));

    const merged = mergeSpecs(official || {}, unofficial || {});
    if ((!merged.quickSpec || merged.quickSpec.length === 0) && merged.detailSpec) {
        merged.quickSpec = formatQuickSpecFromDetail(merged.detailSpec);
    }

    console.log('--- MERGED ---');
    console.log(JSON.stringify(merged, null, 2));
}

run().catch(e => { console.error('Error', e); process.exit(1); });