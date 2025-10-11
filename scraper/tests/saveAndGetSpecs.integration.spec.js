import assert from 'assert';

// Run integration in a fresh runtime: ensure SUPABASE env is not configured
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE = '';

async function run() {
    console.log('Running integration test for saveAndGetSpecs...');

    const { default: saveAndGetSpecs } = await import('../saveAndGetSpecs.js');

    const official = {
        name: 'Galaxy Z Fold7',
        img: 'https://www.samsung.com/resources/images/logo-square-letter.png',
        detailSpec: [
            { category: 'Buying Tool', specifications: [{ name: 'Galaxy Z Fold7', value: '' }] }
        ],
        quickSpec: []
    };

    const unofficial = {
        name: 'Samsung Samsung Galaxy A34',
        img: 'https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-a34.jpg',
        detailSpec: [
            { category: 'Memory', specifications: [{ name: 'Internal', value: '128GB 4GB RAM' }] },
            { category: 'Battery', specifications: [{ name: 'Type', value: 'Li-Ion 5000 mAh' }] }
        ],
        quickSpec: []
    };

    const res = await saveAndGetSpecs(null, official, unofficial, { brand: 'Samsung', model: 'Galaxy A34' });

    assert(res, 'Expected a result');
    const merged = res.merged;
    assert(merged && merged.quickSpec, 'merged.quickSpec expected');

    const find = (name) => (merged.quickSpec || []).find(q => (q.name || '').toLowerCase() === name.toLowerCase());

    const ram = find('RAM size');
    const internal = find('Internal Storage');
    const ramStorage = find('RAM Storage');
    const battSize = find('Battery size');
    const battType = find('Battery type');

    assert(ram && ram.value === '4 GB', `Expected RAM size '4 GB', got ${ram && ram.value}`);
    assert(internal && internal.value === '128 GB', `Expected Internal Storage '128 GB', got ${internal && internal.value}`);
    assert(ramStorage && ramStorage.value === '4 GB / 128 GB', `Expected RAM Storage '4 GB / 128 GB', got ${ramStorage && ramStorage.value}`);
    assert(battSize && battSize.value === '5000 mAh', `Expected Battery size '5000 mAh', got ${battSize && battSize.value}`);
    assert(battType && battType.value.toLowerCase() === 'li-ion', `Expected Battery type 'Li-Ion', got ${battType && battType.value}`);

    // Image selection: merged.img should be unofficial product image (fallback when official is logo)
    assert(merged.img && merged.img.includes('gsmarena') || merged.img.includes('fdn2.gsmarena'), `Expected merged.img to prefer unofficial product image, got ${merged.img}`);

    console.log('saveAndGetSpecs integration test passed');
}

run().catch(err => { console.error(err); process.exit(1); });
