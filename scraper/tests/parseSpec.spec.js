import assert from 'assert';
import { parseVariant, parseBattery } from '../helpers/specParsers.js';

async function run() {
    console.log('Running specParsers tests...');

    // parseVariant tests
    const p1 = parseVariant('128GB 4GB RAM');
    assert.strictEqual(p1.internal, '128 GB');
    assert.strictEqual(p1.ram, '4 GB');

    const p2 = parseVariant('256GB 8GB RAM, 512GB 12GB RAM');
    assert.strictEqual(p2.internal, '256 GB');
    assert.strictEqual(p2.ram, '8 GB');

    const p3 = parseVariant('64GB');
    assert.strictEqual(p3.internal, '64 GB');
    assert.strictEqual(p3.ram, null);

    // parseBattery tests
    const detailSpec = [
        { category: 'Battery', specifications: [{ name: 'Type', value: 'Li-Ion 5000 mAh' }, { name: 'Charging', value: '25W wired' }] }
    ];
    const b1 = parseBattery(detailSpec);
    assert.strictEqual(b1.size, '5000 mAh');
    assert.strictEqual(b1.type.toLowerCase(), 'li-ion');

    const b2 = parseBattery([]);
    assert.strictEqual(b2.size, null);
    assert.strictEqual(b2.type, null);

    console.log('All specParsers tests passed');
}

run().catch(err => { console.error(err); process.exit(1); });
