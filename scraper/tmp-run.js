import { saveAndGetSpecs } from './saveAndGetSpecs.js';

(async () => {
    try {
        const res = await saveAndGetSpecs(null, {}, {}, { brand: 'Samsung', model: 'Galaxy A34' });
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('ERR', e && e.message, e && e.stack);
    }
})();
