import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

async function main() {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Please set SUPABASE_URL and SUPABASE_KEY in environment before running this uploader.');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const outDir = path.resolve('output');
    let files = [];
    try { files = await fs.readdir(outDir); } catch (e) { console.error('No output dir or no files:', e.message); process.exit(1); }
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (!jsonFiles.length) { console.log('No payloads to upload.'); return; }

    const dryRun = process.argv.includes('--dry-run');
    for (const f of jsonFiles) {
        try {
            const content = await fs.readFile(path.join(outDir, f), 'utf8');
            const parsed = JSON.parse(content);
            let payload = parsed.payload;
            if (!payload) { console.warn(f, 'missing payload key'); continue; }
            // sanitize payload to allowed master_unit columns
            const allowed = new Set(['nama_brand', 'nama_model', 'variant', 'kode_model', 'official_specs', 'unofficial_specs', 'status', 'created_at', 'updated_at']);
            if (payload.detailSpec && !payload.unofficial_specs) payload.unofficial_specs = payload.detailSpec;
            if (payload.detail_spec && !payload.unofficial_specs) payload.unofficial_specs = payload.detail_spec;
            if (payload.official_specs && !Array.isArray(payload.official_specs)) payload.official_specs = [payload.official_specs];
            if (payload.unofficial_specs && !Array.isArray(payload.unofficial_specs)) payload.unofficial_specs = [payload.unofficial_specs];
            const sanitized = {};
            for (const k of Object.keys(payload)) if (allowed.has(k)) sanitized[k] = payload[k];
            payload = sanitized;
            // check existing by nama_brand + nama_model
            const { data: found, error: findErr } = await supabase.from('master_unit').select('*').eq('nama_brand', payload.nama_brand).eq('nama_model', payload.nama_model).limit(1).maybeSingle();
            if (findErr) throw findErr;
            if (found) {
                if (dryRun) { console.log('[dry-run] Would update', f, '-> id', found.id_master); }
                else {
                    const { data: upd, error: upErr } = await supabase.from('master_unit').update(payload).eq('id_master', found.id_master).select().limit(1).maybeSingle();
                    if (upErr) throw upErr;
                    console.log('Updated', f, '-> id', upd && upd.id_master);
                }
            } else {
                payload.created_at = new Date().toISOString();
                if (dryRun) { console.log('[dry-run] Would insert', f); }
                else {
                    const { data: ins, error: insErr } = await supabase.from('master_unit').insert(payload).select().limit(1).maybeSingle();
                    if (insErr) throw insErr;
                    console.log('Inserted', f, '-> id', ins && ins.id_master);
                }
            }
        } catch (e) {
            console.error('Failed to upload', f, e && e.message);
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });