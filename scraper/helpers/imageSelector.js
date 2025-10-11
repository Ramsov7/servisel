import axios from 'axios';

// Simple in-memory cache for HEAD responses to avoid repeated network calls during batch runs.
// Keyed by URL, stores { contentType, contentLength, ts }
const CACHE = new Map();

function cacheGet(url, ttl) {
    if (!url) return null;
    const e = CACHE.get(url);
    if (!e) return null;
    if (Date.now() - e.ts > ttl) {
        CACHE.delete(url);
        return null;
    }
    return e;
}

function cacheSet(url, value) {
    CACHE.set(url, { ...value, ts: Date.now() });
}

// Returns best image URL between official and unofficial. Uses quick URL heuristics
// first (filename contains 'logo' etc.), then attempts an HTTP HEAD to check
// content-type and content-length. If HEAD fails, falls back to URL heuristics.
export async function chooseBestImage(officialUrl, unofficialUrl, opts = {}) {
    const timeout = opts.timeout || 3000;
    const ttl = parseInt(process.env.IMAGE_SELECTOR_CACHE_TTL_MS || '600000', 10) || 600000; // default 10 minutes
    const preferOfficialEnv = (process.env.PREFER_OFFICIAL_IMAGE || '').toString().toLowerCase();
    const preferOfficial = preferOfficialEnv === '1' || preferOfficialEnv === 'true';

    function urlLooksLikeLogo(url) {
        if (!url) return false;
        const u = url.toString().toLowerCase();
        if (u.includes('logo') || u.includes('/resources/images/') || u.includes('logo-square') || u.includes('logo-')) return true;
        // common tiny svg placeholders
        if (u.endsWith('.svg') || u.includes('.svg?')) return true;
        return false;
    }

    // If env forces prefer official, return early
    if (preferOfficial && officialUrl) return officialUrl;

    // fast path: prefer unofficial if official obviously a logo
    if (officialUrl && urlLooksLikeLogo(officialUrl) && unofficialUrl) return unofficialUrl;

    // If unofficial missing, return official
    if (!unofficialUrl) return officialUrl || null;

    // Try cached HEAD values first
    let offInfo = cacheGet(officialUrl, ttl);
    let unInfo = cacheGet(unofficialUrl, ttl);

    try {
        if (!offInfo && officialUrl) {
            const headOfficial = await axios.head(officialUrl, { timeout });
            const t = (headOfficial && headOfficial.headers && headOfficial.headers['content-type']) ? headOfficial.headers['content-type'].toString().toLowerCase() : '';
            const l = (headOfficial && headOfficial.headers && (headOfficial.headers['content-length'] || headOfficial.headers['Content-Length'])) ? parseInt(headOfficial.headers['content-length'] || headOfficial.headers['Content-Length']) : null;
            offInfo = { contentType: t, contentLength: l };
            cacheSet(officialUrl, offInfo);
        }
        if (!unInfo) {
            const headUnofficial = await axios.head(unofficialUrl, { timeout });
            const t2 = (headUnofficial && headUnofficial.headers && headUnofficial.headers['content-type']) ? headUnofficial.headers['content-type'].toString().toLowerCase() : '';
            const l2 = (headUnofficial && headUnofficial.headers && (headUnofficial.headers['content-length'] || headUnofficial.headers['Content-Length'])) ? parseInt(headUnofficial.headers['content-length'] || headUnofficial.headers['Content-Length']) : null;
            unInfo = { contentType: t2, contentLength: l2 };
            cacheSet(unofficialUrl, unInfo);
        }

        const tOff = offInfo ? offInfo.contentType : '';
        const tUn = unInfo ? unInfo.contentType : '';
        const lOff = offInfo ? offInfo.contentLength : null;
        const lUn = unInfo ? unInfo.contentLength : null;

        if (process.env.DEBUG_IMAGE_SELECTOR) {
            // eslint-disable-next-line no-console
            console.log('DEBUG_IMAGE_SELECTOR', { tOff, tUn, lOff, lUn, officialUrl, unofficialUrl, ttl });
        }

        // Prefer raster images over SVG and prefer larger images (by bytes)
        const offIsSvg = tOff && tOff.includes('svg');
        const unIsSvg = tUn && tUn.includes('svg');

        if (offIsSvg && !unIsSvg) return unofficialUrl;
        if (!offIsSvg && unIsSvg) return officialUrl;

        // If both non-svg, prefer larger size when available
        if (lOff && lUn) return (lUn > lOff) ? unofficialUrl : officialUrl;

        // If content-types indicate product images (jpeg/png) prefer unofficial
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const offIsRaster = tOff && imageTypes.some(t => tOff.includes(t));
        const unIsRaster = tUn && imageTypes.some(t => tUn.includes(t));
        if (unIsRaster && !offIsRaster) return unofficialUrl;

        // fallback to prefer unofficial when official looks like logo by URL heuristics
        if (urlLooksLikeLogo(officialUrl)) return unofficialUrl;

        // otherwise default to official
        return officialUrl || unofficialUrl;
    } catch (e) {
        // On network errors, fallback to URL heuristics
        if (officialUrl && urlLooksLikeLogo(officialUrl)) return unofficialUrl;
        return officialUrl || unofficialUrl;
    }
}

export default chooseBestImage;
