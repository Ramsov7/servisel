import { scrapeOfficialSpecs } from './official/index.js';
import { scrapeUnofficialSpecs } from './unofficial/index.js';
import { saveAndGetSpecs } from './saveAndGetSpecs.js';

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node index.js <brand> <model> [unitId]');
        process.exit(1);
    }
    const [brand, ...modelParts] = args;
    const model = modelParts.join(' ');
    const unitId = args[args.length - 1] && args.length > 2 ? args[args.length - 1] : null;

    // Try official first
    let official = null;
    try {
        official = await scrapeOfficialSpecs(brand, model);
    } catch (e) {
        console.warn('Official scrape failed:', e.message || e);
    }

    // If no official or empty, try unofficial
    let unofficial = null;
    try {
        if (!official || Object.keys(official).length === 0) {
            unofficial = await scrapeUnofficialSpecs(brand, model);
        } else {
            // still try unofficial as complement (non-blocking)
            try { unofficial = await scrapeUnofficialSpecs(brand, model); } catch (e) { /* ignore */ }
        }
    } catch (e) {
        console.warn('Unofficial scrape failed:', e.message || e);
    }

    const result = await saveAndGetSpecs(unitId, official, unofficial, { brand, model });
    console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
