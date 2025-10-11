import { mergeSpecs, extractBrandModel } from '../helpers/mergeSpecs.js';
import { formatQuickSpecFromDetail } from '../helpers/formatQuickSpec.js';

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(2); } }

// simple merge test
const off = { name: 'iPhone 15', img: 'off.png', detailSpec: [{ category: 'Network', specifications: [{ name: 'Tech', value: '5G' }] }], quickSpec: [] };
const un = { name: 'Apple iPhone 15', img: 'un.png', detailSpec: [{ category: 'Platform', specifications: [{ name: 'OS', value: 'iOS' }] }], quickSpec: [] };
const merged = mergeSpecs(off, un);
assert(merged.name === 'iPhone 15', 'mergeSpecs should prefer official name');
assert(merged.img === 'off.png', 'mergeSpecs should prefer official img');
assert(merged.detailSpec.find(d => d.category === 'Network'), 'Network category present');
assert(merged.detailSpec.find(d => d.category === 'Platform'), 'Platform category present');

// extract brand model
const bm = extractBrandModel('Samsung Galaxy A34');
assert(bm.brand === 'Samsung' && bm.model.includes('Galaxy A34'), 'extractBrandModel works for Samsung');

// quickSpec formatting
const q = formatQuickSpecFromDetail(merged.detailSpec);
assert(Array.isArray(q), 'formatQuickSpecFromDetail returns array');

console.log('All tests passed');
process.exit(0);
