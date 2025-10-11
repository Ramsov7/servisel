function ensureCategoriesOrder(detailSpec) {
    const order = [
        'Network', 'Launch', 'Body', 'Display', 'Platform', 'Memory', 'Main Camera', 'Selfie camera', 'Sound', 'Comms', 'Features', 'Battery', 'Misc', 'Our Tests'
    ];
    const map = {};
    for (const c of detailSpec || []) map[c.category] = c;
    const result = order.map(cat => map[cat] || { category: cat, specifications: [] });
    return result;
}

function mergeDetailSpec(official, unofficial) {
    // Build a map by category
    const out = {};
    (unofficial || []).forEach(cat => { out[cat.category] = { ...cat }; });
    (official || []).forEach(cat => { out[cat.category] = { ...cat }; });
    // Official overrides unofficial - we already spread unofficial first then official
    const arr = Object.values(out);
    return ensureCategoriesOrder(arr);
}

function mergeQuickSpec(official, unofficial) {
    if (official && Array.isArray(official) && official.length) return official;
    if (unofficial && Array.isArray(unofficial) && unofficial.length) return unofficial;
    return [];
}

function mergeMeta(official, unofficial) {
    const name = (official && official.name) || (unofficial && unofficial.name) || 'UNKNOWN';
    const img = (official && official.img) || (unofficial && unofficial.img) || '';
    return { name, img };
}

export function mergeSpecs(official, unofficial) {
    if ((!official || Object.keys(official).length === 0) && (!unofficial || Object.keys(unofficial).length === 0)) return null;

    const meta = mergeMeta(official || {}, unofficial || {});
    const detailSpec = mergeDetailSpec(official && official.detailSpec ? official.detailSpec : [], unofficial && unofficial.detailSpec ? unofficial.detailSpec : []);
    const quickSpec = mergeQuickSpec(official && official.quickSpec ? official.quickSpec : [], unofficial && unofficial.quickSpec ? unofficial.quickSpec : []);

    return {
        name: meta.name,
        img: meta.img,
        detailSpec,
        quickSpec
    };
}

export function extractBrandModel(fullName) {
    if (!fullName || typeof fullName !== 'string') return { brand: 'UNKNOWN', model: 'UNKNOWN' };
    const allowedBrands = ['Samsung', 'Oppo', 'Vivo', 'Apple', 'Huawei', 'Realme', 'Xiaomi', 'Tecno', 'Itel', 'Infinix'];

    // If fullName explicitly contains the brand word, prefer that (e.g. "Samsung Galaxy A34")
    for (const b of allowedBrands) {
        const regex = new RegExp('\\b' + b + '\\b', 'i');
        if (regex.test(fullName)) {
            // remove repeated leading brand tokens from the start of the string
            // e.g. 'Apple Apple iPhone 15' -> 'iPhone 15'
            const leadingBrandRegex = new RegExp('^(?:' + b + '\\s+)+', 'i');
            const rest = fullName.replace(leadingBrandRegex, '').trim();
            // if removing leading tokens leaves the brand elsewhere, also remove any
            // stray occurrences to avoid duplication in model
            const strayRegex = new RegExp('\\b' + b + '\\b', 'ig');
            const cleaned = rest.replace(strayRegex, '').trim();
            return { brand: b, model: cleaned || rest || 'UNKNOWN' };
        }
    }

    // Map common model-family prefixes to brands (e.g. Galaxy -> Samsung, iPhone -> Apple)
    const prefixMap = {
        'Galaxy': 'Samsung',
        'iPhone': 'Apple',
        'Redmi': 'Xiaomi',
        'Mi': 'Xiaomi',
        'Poco': 'Xiaomi',
        'Realme': 'Realme',
        'Vivo': 'Vivo',
        'Oppo': 'Oppo',
        'Infinix': 'Infinix',
        'Tecno': 'Tecno',
        'Itel': 'Itel',
        'Huawei': 'Huawei'
    };

    const firstWord = fullName.split(' ')[0];
    for (const [prefix, mappedBrand] of Object.entries(prefixMap)) {
        if (firstWord.toLowerCase() === prefix.toLowerCase() || fullName.startsWith(prefix + ' ')) {
            // Keep the fullName as model (so "Galaxy Z Fold7" -> model "Galaxy Z Fold7"), brand mapped to Samsung
            return { brand: mappedBrand, model: fullName };
        }
    }

    // Last-resort heuristics: if first word might be brand-like, use it; otherwise UNKNOWN
    const parts = fullName.split(' ');
    if (parts.length >= 2 && allowedBrands.includes(parts[0])) return { brand: parts[0], model: parts.slice(1).join(' ') };

    return { brand: 'UNKNOWN', model: fullName };
}
