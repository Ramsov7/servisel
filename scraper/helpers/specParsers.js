// Helpers to parse variant strings and battery sections into structured pieces

export function parseVariant(variantString) {
    if (!variantString) return { internal: null, ram: null };
    const s = variantString.toString();
    const sizes = s.match(/(\d+\s?GB)/ig) || [];
    function fmt(gb) {
        if (!gb) return null;
        const n = gb.toString().toUpperCase().replace(/\s*/g, ''); // e.g. '128GB'
        return n.replace(/GB$/, ' GB'); // '128 GB'
    }
    const internal = sizes.length >= 1 ? fmt(sizes[0]) : null;
    let ram = null;
    if (sizes.length >= 2) ram = fmt(sizes[1]);
    else {
        const ramMatch = s.match(/(\d+\s?GB)\s*RAM/i);
        if (ramMatch) ram = fmt(ramMatch[1]);
    }
    return { internal, ram };
}

export function parseBattery(detailSpec) {
    if (!detailSpec || !Array.isArray(detailSpec)) return { size: null, type: null };
    const batteryCat = detailSpec.find(c => /battery/i.test(c.category));
    if (!batteryCat) return { size: null, type: null };
    let size = null;
    let type = null;
    for (const s of batteryCat.specifications || []) {
        const v = (s.value || '').toString();
        // Size (mAh)
        const m = v.match(/(\d{3,5})\s?mAh/i);
        if (m && m[1]) size = `${m[1]} mAh`;
        // Chemistry
        const chem = v.match(/\b(Li-?Ion|Li-?Po|Li-?Polymer|Lithium[-\s]?Polymer|Lithium|Polymer)\b/i);
        if (chem && chem[0]) type = chem[0].replace(/\s+/, ' ').trim();
    }
    return { size, type };
}

export default { parseVariant, parseBattery };
