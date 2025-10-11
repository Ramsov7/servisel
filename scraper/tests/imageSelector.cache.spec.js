import assert from 'assert';
import axios from 'axios';

async function run() {
    console.log('Running imageSelector cache test...');
    const mod = await import('../helpers/imageSelector.js');
    const chooseBestImage = mod.chooseBestImage;

    // Monkeypatch axios.head to count calls
    let calls = 0;
    const originalHead = axios.head;
    axios.head = async (url, opts) => {
        calls++;
        // return generic jpeg headers
        return { headers: { 'content-type': 'image/jpeg', 'content-length': '20000' } };
    };

    const off = 'https://example.com/official-product.jpg';
    const un = 'https://cdn.example.com/unofficial-product.jpg';

    // First call should trigger HEADs (2 calls: official + unofficial)
    await chooseBestImage(off, un, { timeout: 1000 });
    assert(calls >= 1, 'Expected at least one HEAD call on first run');

    const callsAfterFirst = calls;

    // Second call should use cache and not increase calls (or at least not double)
    await chooseBestImage(off, un, { timeout: 1000 });
    const callsAfterSecond = calls;

    // Because cache TTL is default 10 minutes, second call should not call HEAD again for same URLs
    assert.strictEqual(callsAfterSecond, callsAfterFirst, `Expected no additional HEAD calls, got ${callsAfterFirst} then ${callsAfterSecond}`);

    // restore
    axios.head = originalHead;

    console.log('imageSelector cache test passed');
}

run().catch(err => { console.error(err); process.exit(1); });
