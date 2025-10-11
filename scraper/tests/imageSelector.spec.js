import assert from 'assert';
import * as imgSel from '../helpers/imageSelector.js';
import axios from 'axios';

async function run() {
    console.log('Running imageSelector tests...');

    // Save original
    const originalHead = axios.head;

    // Test 1: official looks like logo by URL -> prefer unofficial immediately
    const res1 = await imgSel.chooseBestImage('https://example.com/logo-square-letter.png', 'https://cdn.example.com/UNOFFICIAL_TOKEN-product.jpg');
    assert.strictEqual(res1, 'https://cdn.example.com/UNOFFICIAL_TOKEN-product.jpg', 'Should prefer unofficial when official URL contains logo');

    // Test 2: HEAD says official is svg and unofficial is jpeg -> prefer unofficial
    axios.head = async (url) => {
        if (url.includes('OFFICIAL_TOKEN')) return { headers: { 'content-type': 'image/svg+xml', 'content-length': '1024' } };
        if (url.includes('UNOFFICIAL_TOKEN')) return { headers: { 'content-type': 'image/jpeg', 'content-length': '20480' } };
        return { headers: { 'content-type': 'image/jpeg', 'content-length': '20480' } };
    };
    const res2 = await imgSel.chooseBestImage('https://cdn.example.com/OFFICIAL_TOKEN-official.svg', 'https://cdn.example.com/UNOFFICIAL_TOKEN-unofficial.jpg');
    assert.strictEqual(res2, 'https://cdn.example.com/UNOFFICIAL_TOKEN-unofficial.jpg', 'Should prefer unofficial when official is svg and unofficial is jpeg');

    // Test 3: HEAD says unofficial larger -> prefer unofficial
    axios.head = async (url) => {
        if (url.includes('UNOFFICIAL_TOKEN')) return { headers: { 'content-type': 'image/jpeg', 'content-length': '45000' } };
        if (url.includes('OFFICIAL_TOKEN')) return { headers: { 'content-type': 'image/jpeg', 'content-length': '15000' } };
        return { headers: { 'content-type': 'image/jpeg', 'content-length': '15000' } };
    };
    const res3 = await imgSel.chooseBestImage('https://cdn.example.com/OFFICIAL_TOKEN-official.jpg', 'https://cdn.example.com/UNOFFICIAL_TOKEN-unofficial.jpg');
    assert.strictEqual(res3, 'https://cdn.example.com/UNOFFICIAL_TOKEN-unofficial.jpg', 'Should prefer larger image by content-length');

    // Test 4: HEAD network failure -> fallback to URL heuristics
    axios.head = async (url) => { throw new Error('network'); };
    const res4 = await imgSel.chooseBestImage('https://cdn.example.com/logo-OFFICIAL_TOKEN.png', 'https://cdn.example.com/UNOFFICIAL_TOKEN-unofficial.jpg');
    assert.strictEqual(res4, 'https://cdn.example.com/UNOFFICIAL_TOKEN-unofficial.jpg', 'On HEAD error should fallback to URL heuristics and prefer unofficial when official looks like logo');

    // restore
    axios.head = originalHead;

    console.log('All imageSelector tests passed');
}

run().catch(err => { console.error(err); process.exit(1); });
