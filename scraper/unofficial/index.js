import mobileSpecs from './mobile-specs.js';
import gsmarena from './gsmarena.js';
import devicespecs from './devicespecs.js';

export async function scrapeUnofficialSpecs(brand, model) {
    // Try mobile-specs local parser first (if available)
    try {
        const m = await mobileSpecs(brand, model);
        if (m && Object.keys(m).length) return m;
    } catch (e) { }
    // fallback to gsmarena
    try {
        const g = await gsmarena(brand, model);
        if (g && Object.keys(g).length) return g;
    } catch (e) { }
    // last resort: devicespecifications
    try {
        const d = await devicespecs(brand, model);
        if (d && Object.keys(d).length) return d;
    } catch (e) { }
    return {};
}
