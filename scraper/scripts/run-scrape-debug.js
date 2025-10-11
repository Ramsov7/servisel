import { scrapeOfficialSpecs } from '../official/index.js';
import { scrapeUnofficialSpecs } from '../unofficial/index.js';
import saveAndGetSpecs from '../saveAndGetSpecs.js';

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node run-scrape-debug.js <brand> <model>');
        process.exit(1);
    }
    const [brand, ...mp] = args;
    const model = mp.join(' ');

    console.log('Supabase configured:', !!process.env.SUPABASE_URL && !!(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY));

    console.log('\n=== Running official scraper ===');
    let official = {};
    try {
        official = await scrapeOfficialSpecs(brand, model);
        console.log('Official result:', JSON.stringify(official, null, 2));
    } catch (e) {
        console.error('Official scraper error:', e && e.stack ? e.stack : e);
    }

    console.log('\n=== Running unofficial scraper ===');
    let unofficial = {};
    try {
        unofficial = await scrapeUnofficialSpecs(brand, model);
        console.log('Unofficial result:', JSON.stringify(unofficial, null, 2));
    } catch (e) {
        console.error('Unofficial scraper error:', e && e.stack ? e.stack : e);
    }

    console.log('\n=== Running merge/save (no DB write if supabase not configured) ===');
    try {
        const res = await saveAndGetSpecs(null, official, unofficial, { brand, model });
        console.log('Final result:', JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('saveAndGetSpecs error:', e && e.stack ? e.stack : e);
    }
}

main();
