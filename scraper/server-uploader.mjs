import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

async function main() {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment before running this server-side uploader.');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    const outDir = path.resolve('output');
    let files = [];
    try { files = await fs.readdir(outDir); } catch (e) { console.error('No output dir or no files:', e.message); process.exit(1); }
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (!jsonFiles.length) { console.log('No payloads to upload.'); return; }

    for (const f of jsonFiles) {
        try {
            const raw = await fs.readFile(path.join(outDir, f), 'utf8');
            const parsed = JSON.parse(raw);
            let payload = parsed.payload || parsed;
            // sanitize payload: only keep columns present in master_unit schema
            const allowed = new Set(['nama_brand', 'nama_model', 'variant', 'kode_model', 'official_specs', 'unofficial_specs', 'status', 'created_at', 'updated_at']);
            // map legacy/detail fields into unofficial_specs if present
            if (payload.detailSpec && !payload.unofficial_specs) {
                payload.unofficial_specs = payload.detailSpec;
            }
            if (payload.detail_spec && !payload.unofficial_specs) {
                payload.unofficial_specs = payload.detail_spec;
            }
            // ensure official/unofficial specs are arrays or null
            if (payload.official_specs && !Array.isArray(payload.official_specs)) payload.official_specs = [payload.official_specs];
            if (payload.unofficial_specs && !Array.isArray(payload.unofficial_specs)) payload.unofficial_specs = [payload.unofficial_specs];
            // build sanitized object
            const sanitized = {};
            for (const k of Object.keys(payload)) {
                if (allowed.has(k)) sanitized[k] = payload[k];
            }
            payload = sanitized;
            // Ensure minimal schema
            if (!payload.nama_brand || !payload.nama_model) {
                console.warn('Skipping', f, '— missing nama_brand or nama_model');
                continue;
            }
            // upsert by nama_brand + nama_model
            const { data: found, error: findErr } = await supabase.from('master_unit').select('*').eq('nama_brand', payload.nama_brand).eq('nama_model', payload.nama_model).limit(1).maybeSingle();
            if (findErr) throw findErr;
            if (found) {
                const { data: upd, error: upErr } = await supabase.from('master_unit').update(payload).eq('id_master', found.id_master).select().limit(1).maybeSingle();
                if (upErr) throw upErr;
                console.log('Updated', f, '-> id', upd && upd.id_master);
            } else {
                payload.created_at = new Date().toISOString();
                const { data: ins, error: insErr } = await supabase.from('master_unit').insert(payload).select().limit(1).maybeSingle();
                if (insErr) throw insErr;
                console.log('Inserted', f, '-> id', ins && ins.id_master);
            }
        } catch (e) {
            console.error('Failed to upload', f, e && e.message);
        }
    }
}

if (process.argv.includes('--dry-run')) {
    console.log('Dry run: server-uploader syntax OK. To run, set SUPABASE_SERVICE_KEY and SUPABASE_URL env vars and execute this script.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
