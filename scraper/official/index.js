import samsung from './samsung.js';
import apple from './apple.js';

const brands = {
    samsung,
    apple
};

export async function scrapeOfficialSpecs(brand, model) {
    const b = (brand || '').toLowerCase();
    // direct match
    if (brands[b]) return brands[b](brand, model);
    // try matching common names
    if (b.includes('samsung') || b.includes('galaxy')) return samsung(brand, model);
    if (b.includes('apple') || b.includes('iphone')) {
        // Use lightweight Apple scraper first (Puppeteer may not be installed in this workspace)
        try {
            const res = await apple(brand, model);
            if (res && Object.keys(res).length) return res;
        } catch (e) {
            // fallthrough to puppeteer-based scraper as a last resort
        }
        // Try to dynamically load Puppeteer-based scraper only if available
        try {
            const mod = await import('./apple-puppeteer.js');
            const applePuppeteer = mod && mod.default ? mod.default : mod;
            const res2 = await applePuppeteer(brand, model);
            if (res2 && Object.keys(res2).length) return res2;
        } catch (e2) {
            // give up if module not available or fails
        }
        return {};
    }
    return {};
}
