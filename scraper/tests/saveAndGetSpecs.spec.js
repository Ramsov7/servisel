// Ensure Supabase writes are disabled during unit tests
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE = '';
import saveAndGetSpecs from '../saveAndGetSpecs.js';

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(2); } }

(async () => {
    console.log('Test 1: Happy path (no HTML)');
    const official = { name: 'Galaxy Test', img: 'off.png', detailSpec: [{ category: 'Network', specifications: [{ name: 'Tech', value: '5G' }] }], quickSpec: [{ name: 'Chipset', value: 'Exynos' }] };
    const unofficial = { name: 'Samsung Galaxy Test', img: 'un.png', detailSpec: [{ category: 'Memory', specifications: [{ name: 'Internal', value: '128GB 4GB RAM' }] }], quickSpec: [] };
    const res1 = await saveAndGetSpecs(null, official, unofficial, { brand: 'Samsung', model: 'Galaxy Test' });
    console.log('DBG res1:', JSON.stringify(res1, null, 2));
    // normalize return shape: when supabase enabled the function returns { action, row, merged }
    const merged1 = res1 && res1.merged;
    const payload1 = res1 && (res1.payload || res1.row || null);
    assert(merged1 && payload1, 'result object present');
    assert(merged1.name && typeof merged1.name === 'string', 'merged.name present');
    assert(payload1.kode_model === null || payload1.kode_model === undefined, 'no kode_model expected');

    console.log('Test 1 passed');

    console.log('Test 2: HTML-heavy input sanitization');
    const official2 = { name: 'Buying Tool', img: '', detailSpec: [{ category: 'Buying Tool', specifications: [{ name: 'Galaxy Test', value: '' }, { name: '512 GB｜12 GB', value: '' }] }], quickSpec: [] };
    const unofficial2 = { name: 'Samsung Galaxy X', img: 'img.png', detailSpec: [{ category: 'Display', specifications: [{ name: 'Size', value: '6.6 inches, 106.9 cm<sup>2</sup> (~84.9% screen-to-body ratio)' }] }, { category: 'Misc', specifications: [{ name: 'Models', value: 'SM-TEST1, SM-TEST2' }] }], quickSpec: [] };
    const res2 = await saveAndGetSpecs(null, official2, unofficial2, { brand: 'Samsung', model: 'Galaxy X' });
    const merged2 = res2 && res2.merged;
    const payload2 = res2 && (res2.payload || res2.row || null);
    assert(merged2 && payload2, 'result object present');
    // merged should prefer unofficial name because official is 'Buying Tool'
    assert(merged2.name.toLowerCase().includes('samsung') || merged2.name.toLowerCase().includes('galaxy x'), 'merged used unofficial name');
    // Size should be sanitized (no sup tags)
    const display = merged2.detailSpec.find(c => c.category === 'Display');
    assert(display && display.specifications && display.specifications[0] && !display.specifications[0].value.includes('<sup>'), 'sup tags removed');
    // kode_model should be extracted from Misc->Models
    assert(payload2.kode_model && payload2.kode_model.toLowerCase().startsWith('sm-'), 'kode_model extracted');

    console.log('Test 2 passed');

    console.log('All saveAndGetSpecs tests passed');
    process.exit(0);
})();
