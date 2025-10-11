import { supabase, findMasterById, upsertMaster, isSupabaseConfigured } from './supabase.js';
import { mergeSpecs, extractBrandModel } from './helpers/mergeSpecs.js';
import { formatQuickSpecFromDetail } from './helpers/formatQuickSpec.js';
import { htmlToText } from 'html-to-text';
import { load } from 'cheerio';
import he from 'he';

function nowISO() {
    // Return an ISO timestamp adjusted to WITA (UTC+08:00) with explicit +08:00 offset.
    // We compute current time, add 8 hours, then format as ISO without Z but with +08:00.
    const now = new Date();
    const offsetMs = 8 * 60 * 60 * 1000; // +8 hours
    const t = new Date(now.getTime() + offsetMs);
    const pad = (n) => String(n).padStart(2, '0');
    const YYYY = t.getUTCFullYear();
    const MM = pad(t.getUTCMonth() + 1);
    const DD = pad(t.getUTCDate());
    const hh = pad(t.getUTCHours());
    const mm = pad(t.getUTCMinutes());
    const ss = pad(t.getUTCSeconds());
    const ms = String(t.getUTCMilliseconds()).padStart(3, '0');
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}.${ms}+08:00`;
}

// UTC helper for DB writes — keep DB stored in UTC
function utcNowISO() {
    return new Date().toISOString();
}

function normalizeSpecForStorage(obj) {
    // Ensure keys exist per schema
    function stripHtml(raw) {
        if (raw === null || raw === undefined) return '';
        try {
            // Preprocess with cheerio: remove unwanted nodes, keep text nodes
            const $ = load(raw.toString());
            // Remove nodes that commonly inject UI/JS or visual-only markup
            $('sup').remove();
            $('div.popover').remove();
            // unwind anchors but keep their text
            $('a').each((i, el) => {
                const txt = $(el).text() || '';
                $(el).replaceWith(txt);
            });

            // Get cleaned HTML and decode entities
            let cleanedHtml = $.html();
            cleanedHtml = he.decode(cleanedHtml);

            // Convert to text
            let txt = htmlToText(cleanedHtml, {
                wordwrap: false,
                selectors: [
                    { selector: 'img', format: 'skip' }
                ],
                uppercaseHeadings: false
            }).trim();

            // Final cleanup
            txt = txt.replace(/<[^>]+>/g, '');
            txt = txt.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
            return txt;
        } catch (e) {
            return he.decode(raw.toString().replace(/<[^>]*>/g, '')).trim();
        }
    }

    return {
        name: stripHtml(obj.name) || 'UNKNOWN',
        img: obj.img || '',
        detailSpec: (obj.detailSpec || []).map(cat => ({ category: cat.category, specifications: (cat.specifications || []).map(s => ({ name: stripHtml(s.name), value: Array.isArray(s.value) ? s.value.map(v => stripHtml(v)).join('\n') : stripHtml(s.value) })) })),
        quickSpec: (obj.quickSpec || []).map(s => ({ name: stripHtml(s.name), value: stripHtml(s.value) }))
    };
}

export async function saveAndGetSpecs(unitId, officialData, unofficialData, ctx = {}) {
    // Merge according to rules
    const merged = mergeSpecs(officialData || {}, unofficialData || {});
    if (!merged) return null;

    // If quickSpec empty, try to derive from details
    if ((!merged.quickSpec || merged.quickSpec.length === 0) && merged.detailSpec) {
        merged.quickSpec = formatQuickSpecFromDetail(merged.detailSpec);
    }

    // Prepare storage objects
    // store the original objects (normalized for schema) as JSONB
    const officialStored = officialData && Object.keys(officialData).length ? normalizeSpecForStorage(officialData) : [];
    const unofficialStored = unofficialData && Object.keys(unofficialData).length ? normalizeSpecForStorage(unofficialData) : [];


    // Parse brand/model from merged.name or ctx
    // Heuristic: prefer unofficial.name when the official name appears trivial or doesn't include
    // the expected brand/model tokens from the query (ctx). This avoids cases where an official
    // page returns a helper title like "Buying Tool" or a different product name.
    let fullName = merged.name || (ctx.brand ? `${ctx.brand} ${ctx.model || ''}`.trim() : 'UNKNOWN');
    try {
        const lowerOfficial = (merged.name || '').toString().toLowerCase();
        const lowerUnofficialName = (unofficialData && unofficialData.name || '').toString().toLowerCase();
        const brandToken = (ctx.brand || '').toString().toLowerCase();
        const modelToken = (ctx.model || '').toString().toLowerCase();

        const trivialOfficial = lowerOfficial.includes('buying') || lowerOfficial.includes('buy') || lowerOfficial.length <= 3;

        // Check whether official/unofficial include brand/model tokens
        const officialHasBrand = brandToken ? lowerOfficial.includes(brandToken) : false;
        const unofficialHasBrand = brandToken ? lowerUnofficialName.includes(brandToken) : false;
        const officialHasModel = modelToken ? lowerOfficial.includes(modelToken) : false;
        const unofficialHasModel = modelToken ? lowerUnofficialName.includes(modelToken) : false;

        // Query token presence check as a weaker signal
        const queryStr = (ctx.brand ? `${ctx.brand} ${ctx.model || ''}` : '').toString().toLowerCase();
        const queryTokens = queryStr.split(' ').filter(Boolean);
        let nameMatchesQuery = false;
        for (let t of queryTokens) {
            if (t && lowerOfficial.includes(t)) { nameMatchesQuery = true; break; }
        }

        const preferUnofficial = (
            trivialOfficial ||
            (!officialHasBrand && unofficialHasBrand) ||
            (!officialHasModel && unofficialHasModel) ||
            !nameMatchesQuery
        );

        if (preferUnofficial && unofficialData && unofficialData.name) {
            fullName = unofficialData.name;
            // also update merged.name for downstream
            merged.name = fullName;
        }
    } catch (e) {
        // ignore heuristic failures
    }
    const { brand, model } = extractBrandModel(fullName);
    const nama_brand = brand || 'UNKNOWN';
    const nama_model = model || 'UNKNOWN';

    // Normalize brand to canonical list
    const canonicalMap = {
        'galaxy': 'Samsung',
        'samsung': 'Samsung',
        'iphone': 'Apple',
        'apple': 'Apple'
    };
    const bkey = (nama_brand || '').toString().toLowerCase();
    const canonicalBrand = canonicalMap[bkey] || Object.keys(canonicalMap).find(k => nama_model.toLowerCase().includes(k)) ? (canonicalMap[bkey] || (nama_model.toLowerCase().includes('galaxy') ? 'Samsung' : (nama_model.toLowerCase().includes('iphone') ? 'Apple' : nama_brand))) : nama_brand;
    const finalNamaBrand = canonicalBrand || nama_brand;

    // If both sources empty -> no insert/update
    if ((!officialStored || officialStored.length === 0) && (!unofficialStored || unofficialStored.length === 0)) return null;

    const payload = {
        nama_brand,
        nama_model,
        official_specs: officialStored || [],
        unofficial_specs: unofficialStored || [],
        // merged_specs will store the normalized merged representation (detailSpec + quickSpec + img/name)
        merged_specs: null,
        status: 'aktif',
        updated_at: utcNowISO()
    };

    // local holders for extracted values — do NOT send these columns to DB (schema removed)
    let discoveredVariant = null;
    let discoveredKodeModel = null;

    // Prepare cleaned merged representation now (after name heuristics above)
    const mergedStored = normalizeSpecForStorage(merged);

    // Image selection: prefer best image from helper (may perform HEAD checks)
    try {
        // lazy import to avoid top-level network in modules that don't need it
        const { chooseBestImage } = await import('./helpers/imageSelector.js');
        mergedStored.img = await chooseBestImage(officialStored && officialStored.img, unofficialStored && unofficialStored.img);
    } catch (e) {
        // fallback to previous simple heuristic
        const looksLikeLogo = (url) => {
            if (!url) return false;
            const lower = url.toString().toLowerCase();
            return (lower.includes('logo') || lower.includes('/resources/images/') || lower.includes('logo-square') || lower.includes('logo-'));
        };
        if (officialStored && officialStored.img && !looksLikeLogo(officialStored.img)) mergedStored.img = officialStored.img;
        else if (unofficialStored && unofficialStored.img) mergedStored.img = unofficialStored.img;
        else mergedStored.img = officialStored && officialStored.img ? officialStored.img : (unofficialStored && unofficialStored.img ? unofficialStored.img : mergedStored.img || '');
    }

    // Heuristics: extract kode_model and variant from structured categories where possible
    try {
        // Try to extract kode_model from Misc -> Models
        const misc = (mergedStored.detailSpec || []).find(c => /misc/i.test(c.category));
        if (misc && Array.isArray(misc.specifications)) {
            const modelsSpec = misc.specifications.find(s => /models?/i.test(s.name));
            const maybeValue = modelsSpec && modelsSpec.value ? modelsSpec.value : null;
            if (maybeValue) {
                // keep models list locally for enrichment but do NOT write to DB
                discoveredKodeModel = maybeValue.split(/[\n]+/).map(p => p.trim()).filter(Boolean).join(', ');
            }
        }

        // Variant: prefer Memory -> Internal listing
        const memory = (mergedStored.detailSpec || []).find(c => /memory/i.test(c.category));
        if (memory && Array.isArray(memory.specifications)) {
            const internal = memory.specifications.find(s => /internal/i.test(s.name));
            if (internal && internal.value) {
                // pick first option (comma or newline separated)
                const first = internal.value.split(/[,\n]+/)[0].trim();
                if (first) discoveredVariant = first.replace(/\s{2,}/g, ' ');
            }
        }

        // Fallback: look into Buying Tool or quickSpec for storage/RAM combos
        if (!payload.variant) {
            const buying = (mergedStored.detailSpec || []).find(c => /buying/i.test(c.category));
            if (buying && Array.isArray(buying.specifications)) {
                // some entries have storage info in the specification 'name'
                const storageSpec = buying.specifications.find(s => /\d+\s?GB/i.test(s.name) || /\d+\s?GB/i.test(s.value));
                if (storageSpec) discoveredVariant = (storageSpec.name || storageSpec.value).trim();
            }
        }
    } catch (e) {
        // ignore extraction failures
    }

    // Fallback: scan each specification text for model code patterns and variant patterns
    try {
        if (!payload.kode_model || !payload.variant) {
            const modelPatterns = [
                /SM[\s-]*[A-Z0-9]+/i,
                /\b[A-Z]{2,4}-\d+[A-Z0-9-]*\b/i,
                /\b[A-Z0-9]{2,}-\d+[A-Z0-9-]*\b/i
            ];

            const variantPatterns = [
                /(\d+\s?GB(?:\s*\d+\s?GB\s*RAM)?)/i,
                /(\d+GB\s*\d+GB\s*RAM)/i,
                /(\d+\s?GB\s*RAM)/i
            ];

            // Collect multiple text sources to search: detailSpec, quickSpec, merged name, and raw source data
            const searchTexts = [];
            for (const cat of (mergedStored.detailSpec || [])) {
                for (const spec of (cat.specifications || [])) {
                    searchTexts.push([spec.name || '', spec.value || ''].join(' '));
                }
            }
            for (const qs of (mergedStored.quickSpec || [])) {
                searchTexts.push([qs.name || '', qs.value || ''].join(' '));
            }
            if (mergedStored.name) searchTexts.push(mergedStored.name);
            // include original raw payloads as a last resort
            try { if (officialData) searchTexts.push(JSON.stringify(officialData)); } catch (e) { }
            try { if (unofficialData) searchTexts.push(JSON.stringify(unofficialData)); } catch (e) { }

            for (const texts of searchTexts) {
                if (!texts) continue;

                if (!payload.kode_model) {
                    for (const pat of modelPatterns) {
                        const m = texts.match(pat);
                        if (m && m[0]) {
                            discoveredKodeModel = m[0].toString().replace(/\s+/g, '-').toUpperCase();
                            break;
                        }
                    }
                }

                if (!payload.variant) {
                    for (const vpat of variantPatterns) {
                        const v = texts.match(vpat);
                        if (v && v[1]) {
                            discoveredVariant = v[1].replace(/\s{2,}/g, ' ').trim();
                            break;
                        }
                    }
                }

                if (payload.kode_model && payload.variant) break;
            }
        }
    } catch (e) {
        // ignore fallback failures
    }

    // Enrich mergedStored.quickSpec with variant and battery details (use extracted payload)
    try {
        const { parseVariant, parseBattery } = await import('./helpers/specParsers.js');
        // Ensure mergedStored is available
        // Note: mergedStored created earlier
        mergedStored.quickSpec = mergedStored.quickSpec || [];

        function upsertQuick(name, value, force = false) {
            if (!value) return;
            const idx = mergedStored.quickSpec.findIndex(q => (q.name || '').toLowerCase() === (name || '').toLowerCase());
            if (idx >= 0) {
                if (force || !mergedStored.quickSpec[idx].value) mergedStored.quickSpec[idx].value = value;
            } else mergedStored.quickSpec.push({ name, value });
        }

        if (discoveredVariant) {
            const parsed = parseVariant(discoveredVariant.toString());
            if (parsed.internal) upsertQuick('Internal Storage', parsed.internal, true);
            if (parsed.ram) upsertQuick('RAM size', parsed.ram, true);
            // Also write combined 'RAM Storage' as 'RAM / Storage' with RAM first
            if (parsed.ram && parsed.internal) upsertQuick('RAM Storage', `${parsed.ram} / ${parsed.internal}`, true);
            else if (parsed.ram) upsertQuick('RAM Storage', `${parsed.ram}`, true);
            else if (parsed.internal) upsertQuick('RAM Storage', `${parsed.internal}`, true);
        }

        // Battery parsing from detailSpec
        const batt = parseBattery(mergedStored.detailSpec || []);
        // Prefer parsed size/type from parseBattery. If parseBattery doesn't provide
        // chemistry type but existing quickSpec contains an mAh value in 'Battery type',
        // move that value to 'Battery size' and remove the incorrect 'Battery type'.
        const existingBatteryTypeIdx = mergedStored.quickSpec.findIndex(q => (q.name || '').toLowerCase() === 'battery type');
        const existingBatterySizeIdx = mergedStored.quickSpec.findIndex(q => (q.name || '').toLowerCase() === 'battery size');

        if (batt.size) upsertQuick('Battery size', batt.size, true);

        if (batt.type) {
            // parsed chemistry available (e.g., 'Li-Ion')
            upsertQuick('Battery type', batt.type, true);
        } else {
            // No parsed chemistry. Check whether existing 'Battery type' looks like an mAh value
            if (existingBatteryTypeIdx >= 0) {
                const existingVal = (mergedStored.quickSpec[existingBatteryTypeIdx].value || '').toString();
                const m = existingVal.match(/(\d{3,5}\s?mAh)/i);
                if (m && m[1]) {
                    const mAh = m[1].replace(/\s*/g, ' ').trim();
                    // If we don't already have a proper Battery size, move this over
                    if (!batt.size && existingBatterySizeIdx === -1) {
                        upsertQuick('Battery size', mAh, true);
                    }
                    // remove the incorrect Battery type entry
                    mergedStored.quickSpec.splice(existingBatteryTypeIdx, 1);
                }
            }
        }

        // Camera parsing: create clearer Main camera and Selfie camera quickSpec entries
        try {
            const cameraCats = mergedStored.detailSpec || [];
            const mainCat = cameraCats.find(c => /main camera|main camera/i.test((c.category || '').toString().toLowerCase()));
            const selfieCat = cameraCats.find(c => /selfie camera|selfie/i.test((c.category || '').toString().toLowerCase()));

            // Helper to extract MP and optional descriptors from a value string
            function extractMpComponents(str) {
                if (!str) return [];
                // normalize
                const s = str.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
                const comps = [];
                const re = /(\d+\s?MP)(?:[^()]*\(([^)]+)\))?/ig; // capture MP and parenthetical descriptor
                let m;
                while ((m = re.exec(s)) !== null) {
                    const mp = (m[1] || '').toUpperCase().replace(/\s+/, ' ');
                    const desc = m[2] ? m[2].trim() : null;
                    comps.push(desc ? `${mp} (${desc})` : mp);
                }
                return comps;
            }

            // Main camera
            if (mainCat && Array.isArray(mainCat.specifications)) {
                // Prefer specification entries whose name indicates 'Triple'/'Dual' etc.
                let spec = mainCat.specifications.find(s => /(triple|quad|dual|single)/i.test(s.name || '')) || mainCat.specifications[0];
                const comps = extractMpComponents(spec.value || spec.name || '');
                if (comps.length > 0) {
                    const header = (spec.name || '').trim() || 'Main camera';
                    upsertQuick('Main camera', `${header}, ${comps.join(' + ')}`, true);
                    // remove any empty 'Camera pixels' entry
                    const idx = mergedStored.quickSpec.findIndex(q => (q.name || '').toLowerCase() === 'camera pixels');
                    if (idx >= 0) mergedStored.quickSpec.splice(idx, 1);
                }
            }

            // Selfie camera
            if (selfieCat && Array.isArray(selfieCat.specifications)) {
                const spec = selfieCat.specifications.find(s => /(single|dual|triple)/i.test(s.name || '')) || selfieCat.specifications[0];
                const comps = extractMpComponents(spec.value || spec.name || '');
                if (comps.length > 0) {
                    const header = (spec.name || '').trim() || 'Selfie camera';
                    upsertQuick('Selfie camera', `${header}, ${comps.join(' + ')}`, true);
                    const idx = mergedStored.quickSpec.findIndex(q => (q.name || '').toLowerCase() === 'camera pixels');
                    if (idx >= 0) mergedStored.quickSpec.splice(idx, 1);
                }
            }
        } catch (e) {
            // ignore camera parsing failures
        }

        // (handled above by parseBattery)
    } catch (e) {
        // ignore enrichment failures
    }

    // --- New: ensure quickSpec contains a unified 'Variant RAM Storage' entry mirroring detailSpec internal options
    try {
        mergedStored.quickSpec = mergedStored.quickSpec || [];

        // Helper to remove existing quickSpec entries by name (case-insensitive)
        function removeQuickNames(names) {
            const lowers = (names || []).map(n => (n || '').toString().toLowerCase());
            mergedStored.quickSpec = mergedStored.quickSpec.filter(q => !lowers.includes((q.name || '').toString().toLowerCase()));
        }

        // Extract Variant string from detailSpec.Memory -> Internal if present
        function extractVariantFromDetail(detailSpec) {
            if (!Array.isArray(detailSpec)) return null;
            const memory = detailSpec.find(c => /memory/i.test((c.category || '').toString().toLowerCase()));
            if (!memory || !Array.isArray(memory.specifications)) return null;
            const internal = memory.specifications.find(s => /internal/i.test((s.name || '').toString().toLowerCase()));
            if (!internal || !internal.value) return null;
            // Normalize spaces and ensure consistent 'GB' formatting
            const parts = internal.value.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
            const cleaned = parts.map(p => {
                let q = p.replace(/(\d)\s+(\d)/g, '$1$2');
                q = q.replace(/G\s*B/ig, 'GB');
                // If value like '128GB 6GB RAM' produce '6 GB / 128 GB'
                const gbMatches = q.match(/(\d+\s*GB)/ig) || [];
                const ramMatch = q.match(/(\d+\s*GB)\s*RAM/i);
                let ram = null, storage = null;
                if (ramMatch) {
                    ram = ramMatch[1];
                    for (const m of gbMatches) if (m.toUpperCase() !== ram.toUpperCase()) storage = m;
                } else if (gbMatches.length >= 2) {
                    const nums = gbMatches.map(x => parseInt(x.replace(/\D/g, ''), 10));
                    if (!isNaN(nums[0]) && !isNaN(nums[1])) {
                        if (nums[0] > nums[1]) { storage = gbMatches[0]; ram = gbMatches[1]; }
                        else { storage = gbMatches[1]; ram = gbMatches[0]; }
                    } else { storage = gbMatches[0]; ram = gbMatches[1]; }
                }
                if (ram && storage) {
                    const rf = ram.toUpperCase().replace(/\s*/g, '').replace(/GB$/, ' GB');
                    const sf = storage.toUpperCase().replace(/\s*/g, '').replace(/GB$/, ' GB');
                    return `${rf} / ${sf}`;
                }
                return null;
            }).filter(Boolean);
            if (cleaned.length) return cleaned.join(', ');
            return null;
        }

        // Remove old entries
        removeQuickNames(['RAM size', 'Internal Storage', 'RAM Storage']);

        const variantStr = extractVariantFromDetail(mergedStored.detailSpec || []);
        if (variantStr) {
            mergedStored.quickSpec.push({ name: 'Variant RAM Storage', value: variantStr });
            // preserve discoveredVariant locally but do NOT write to DB (schema removed)
            discoveredVariant = variantStr;
        }
    } catch (e) {
        // ignore errors in this non-critical transformation
    }

    // If Supabase not configured, just return merged result and payload for inspection
    // Before any DB ops, transform Memory->Internal strings to 'RAM then Storage' format
    function transformInternalMemory(detailSpec) {
        if (!Array.isArray(detailSpec)) return detailSpec;
        return detailSpec.map(cat => {
            if (!/memory/i.test(cat.category)) return cat;
            const specs = (cat.specifications || []).map(s => {
                if (!/internal/i.test((s.name || '').toString().toLowerCase()) || !s.value) return s;
                const parts = s.value.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
                const transformed = [];
                const fmtGB = (tok) => tok.replace(/\s+/g, '').toUpperCase().replace(/GB$/, ' GB');
                for (let p of parts) {
                    // remove spaces between digits like '1 2 8' -> '128'
                    let q = p.replace(/(\d)\s+(\d)/g, '$1$2');
                    q = q.replace(/G\s*B/ig, 'GB');
                    const gbMatches = q.match(/(\d+\s*GB)/ig) || [];
                    const ramMatch = q.match(/(\d+\s*GB)\s*RAM/i);
                    let ram = null;
                    let internal = null;
                    if (ramMatch) {
                        ram = ramMatch[1];
                        for (const m of gbMatches) {
                            if (m.toUpperCase() !== ram.toUpperCase()) internal = m;
                        }
                    } else if (gbMatches.length >= 2) {
                        // pick the larger as storage when possible
                        const nums = gbMatches.map(x => parseInt(x.replace(/\D/g, ''), 10));
                        if (!isNaN(nums[0]) && !isNaN(nums[1])) {
                            if (nums[0] > nums[1]) { internal = gbMatches[0]; ram = gbMatches[1]; }
                            else { internal = gbMatches[1]; ram = gbMatches[0]; }
                        } else {
                            internal = gbMatches[0]; ram = gbMatches[1];
                        }
                    } else {
                        // cannot interpret
                        continue;
                    }

                    if (ram && internal) {
                        const rf = fmtGB(ram);
                        const inf = fmtGB(internal);
                        transformed.push(`${rf} / ${inf}`);
                    }
                }
                if (transformed.length) return Object.assign({}, s, { name: 'Variant RAM Storage', value: transformed.join(', ') });
                return s;
            });
            return Object.assign({}, cat, { specifications: specs });
        });
    }

    // apply transformation to mergedStored.detailSpec so merged output contains reformatted memory
    mergedStored.detailSpec = transformInternalMemory(mergedStored.detailSpec || []);

    // attach merged representation to payload so DB keeps a canonical merged copy
    try {
        payload.merged_specs = mergedStored;
    } catch (e) {
        // ignore any serialization issues here
    }

    if (!isSupabaseConfigured) {
        return { merged: mergedStored, payload };
    }

    // Helper: convert a Date or ISO string to WITA ISO (+08:00)
    function toWitaIso(dateInput) {
        if (!dateInput) return null;
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        const offsetMs = 8 * 60 * 60 * 1000; // +8 hours
        const t = new Date(d.getTime() + offsetMs);
        const pad = (n) => String(n).padStart(2, '0');
        const YYYY = t.getUTCFullYear();
        const MM = pad(t.getUTCMonth() + 1);
        const DD = pad(t.getUTCDate());
        const hh = pad(t.getUTCHours());
        const mm = pad(t.getUTCMinutes());
        const ss = pad(t.getUTCSeconds());
        const ms = String(t.getUTCMilliseconds()).padStart(3, '0');
        return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}.${ms}+08:00`;
    }

    function formatRowTimestamps(row) {
        if (!row || typeof row !== 'object') return row;
        const out = Object.assign({}, row);
        try {
            if (out.created_at) out.created_at = toWitaIso(out.created_at) || out.created_at;
            if (out.updated_at) out.updated_at = toWitaIso(out.updated_at) || out.updated_at;
        } catch (e) {
            // ignore formatting failures
        }
        return out;
    }

    // Persist to Supabase
    if (!unitId) {
        // check for existing by nama_brand + nama_model to avoid duplicates
        if (isSupabaseConfigured) {
            try {
                const { data: found, error } = await supabase.from('master_unit').select('*').eq('nama_brand', nama_brand).eq('nama_model', nama_model).limit(1).maybeSingle();
                if (error) throw error;
                if (found) {
                    // Update existing record with any new data we have (official/unofficial)
                    const toUpdate = {};
                    if (officialStored && officialStored.length) toUpdate.official_specs = officialStored;
                    if (unofficialStored && unofficialStored.length) toUpdate.unofficial_specs = unofficialStored;
                    // always update merged_specs so DB contains the canonical merged object
                    toUpdate.merged_specs = mergedStored;
                    // always update updated_at (store in UTC). Do not write last_synced here — scheduler will set it.
                    toUpdate.updated_at = utcNowISO();
                    // Do NOT write kode_model or variant columns (schema removed). Keep values local only.
                    if (Object.keys(toUpdate).length > 0) {
                        const updated = await upsertMaster(found.id_master, toUpdate);
                        return { action: 'update', row: formatRowTimestamps(updated), merged: mergedStored };
                    }
                    return { action: 'noop', row: formatRowTimestamps(found), merged: mergedStored };
                }
            } catch (e) {
                // continue to insert if check fails
                console.warn('Warning: could not check existing record before insert:', e.message || e);
            }
        }
        payload.created_at = utcNowISO();
        const inserted = await upsertMaster(null, payload);
        return { action: 'insert', row: formatRowTimestamps(inserted), merged: mergedStored };
    }

    // Update existing
    const existing = await findMasterById(unitId);
    if (!existing) {
        payload.created_at = utcNowISO();
        const inserted = await upsertMaster(null, payload);
        return { action: 'insert', row: formatRowTimestamps(inserted), merged: mergedStored };
    }

    // Only update columns with new data
    const toUpdate = {};
    if (officialStored && officialStored.length) toUpdate.official_specs = officialStored;
    if (unofficialStored && unofficialStored.length) toUpdate.unofficial_specs = unofficialStored;
    // always update merged_specs so DB has canonical merged object
    toUpdate.merged_specs = mergedStored;
    // Do NOT write kode_model or variant columns (schema removed). Keep values local only.
    if (Object.keys(toUpdate).length === 0) return { action: 'noop', row: formatRowTimestamps(existing), merged: mergedStored };
    toUpdate.updated_at = utcNowISO();

    const updated = await upsertMaster(unitId, toUpdate);
    return { action: 'update', row: formatRowTimestamps(updated), merged: mergedStored };
}

export default saveAndGetSpecs;
