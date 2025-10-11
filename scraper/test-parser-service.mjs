import { createRequire } from 'module';
const require = createRequire(import.meta.url);
(async () => {
    try {
        const serviceMod = require('../../mobile-specs-api-main/dist/parser/parser.service.js');
        const ParserService = serviceMod.ParserService || serviceMod.default;
        const svc = new ParserService();
        const q = 'iPhone 15';
        console.log('Searching for', q);
        const res = await svc.search(q);
        console.log('Search results length:', Array.isArray(res) ? res.length : typeof res);
        if (Array.isArray(res)) console.log(res.slice(0, 5));
    } catch (e) {
        console.error('Error calling parser service:', e);
    }
})();