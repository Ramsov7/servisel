#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { extractBrandModel } from './helpers/mergeSpecs.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment before running this fixer.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

async function run() {
    console.log('Fetching master_unit rows...');
    const { data, error } = await supabase.from('master_unit').select('*').limit(1000);
    if (error) {
        console.error('Failed to fetch master_unit rows:', error);
        process.exit(1);
    }
    let changed = 0;
    for (const row of data || []) {
        const id = row.id_master;
        const brand = (row.nama_brand || '').toString().trim();
        const model = (row.nama_model || '').toString().trim();
        if (!brand || !model) continue;
        // Use extractBrandModel on combined string to get cleaned model
        const combined = (brand + ' ' + model).trim();
        const { brand: detectedBrand, model: detectedModel } = extractBrandModel(combined);
        // Ensure we don't accidentally overwrite brand; prefer existing row.brand
        const cleanedModel = (detectedModel || model).trim();
        if (!cleanedModel) continue;
        // If cleanedModel equals model (case-sensitive) skip
        if (cleanedModel === model) continue;
        try {
            const upd = { nama_model: cleanedModel, updated_at: new Date().toISOString() };
            const { data: udata, error: uerr } = await supabase.from('master_unit').update(upd).eq('id_master', id).select().limit(1).maybeSingle();
            if (uerr) {
                console.error('Failed to update', id, uerr.message || uerr);
            } else {
                console.log('Updated', id, '=>', model, '->', cleanedModel);
                changed++;
            }
        } catch (e) {
            console.error('Exception updating', id, e && e.message);
        }
    }
    console.log('Done. Rows changed:', changed);
}

run().catch(e => { console.error(e); process.exit(1); });
