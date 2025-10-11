import saveAndGetSpecs from '../saveAndGetSpecs.js';

async function run() {
    console.log('Test extractor: kode_model & variant');

    // Case 1: misc -> models contains SM-A346E
    const official1 = {
        name: 'Test Phone',
        img: 'o.png',
        detailSpec: [
            { category: 'Misc', specifications: [{ name: 'Models', value: 'SM-A346E / SM-A346B' }] },
            { category: 'Memory', specifications: [{ name: 'Internal', value: '64GB 4GB RAM' }] }
        ],
        quickSpec: []
    };
    const res1 = await saveAndGetSpecs(null, official1, {});
    console.log('Case1 result payload:', res1.payload || res1.row);
    if (!res1.payload && !res1.row) throw new Error('Case1: expected payload/row');
    const got1 = (res1.payload || res1.row);
    if (got1.kode_model !== 'SM-A346E') throw new Error('Case1: kode_model mismatch: ' + got1.kode_model);
    if (got1.variant !== '64GB 4GB RAM' && (!res1.merged || !res1.merged.detailSpec)) throw new Error('Case1: variant not set');

    // Case 2: memory internal has variant only
    const official2 = {
        name: 'Another Phone',
        img: 'o2.png',
        detailSpec: [
            { category: 'Memory', specifications: [{ name: 'Internal', value: '128GB 6GB RAM' }] }
        ],
        quickSpec: []
    };
    const res2 = await saveAndGetSpecs(null, official2, {});
    const got2 = (res2.payload || res2.row);
    console.log('Case2 result payload:', got2);
    if (!got2.variant || !/128GB/i.test(got2.variant)) throw new Error('Case2: variant extraction failed: ' + got2.variant);

    // Case 3: fallback scan across detailSpec text
    const official3 = {
        name: 'Fallback Phone',
        detailSpec: [
            { category: 'Platform', specifications: [{ name: 'Chipset', value: 'Exynos' }] },
            { category: 'Other', specifications: [{ name: 'Notes', value: 'Also known as SM-A346E in some markets; available in 128GB 4GB RAM' }] }
        ]
    };
    const res3 = await saveAndGetSpecs(null, official3, {});
    const got3 = (res3.payload || res3.row);
    console.log('Case3 result payload:', got3);
    if (!got3.kode_model || !/SM-A346E/i.test(got3.kode_model)) throw new Error('Case3: kode_model fallback failed: ' + got3.kode_model);
    if (!got3.variant || !/128GB/i.test(got3.variant)) throw new Error('Case3: variant fallback failed: ' + got3.variant);

    console.log('All extractor tests passed');
}

run().catch(e => { console.error('Extractor tests failed:', e); process.exit(1); });
