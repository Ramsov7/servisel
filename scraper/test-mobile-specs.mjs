import scrapeMobileSpecs from './unofficial/mobile-specs.js';

(async () => {
    const res = await scrapeMobileSpecs('Apple', 'iPhone 15');
    console.log('Result:', JSON.stringify(res, null, 2));
})();