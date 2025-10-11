import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
// Prefer a service-role key for server-side writes. Falls back to SUPABASE_KEY for legacy envs.
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE);

let supabase = null;
if (isSupabaseConfigured) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
} else {
    console.warn('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE (or SUPABASE_KEY) env vars to enable DB writes.');
}

export { supabase };

export async function findMasterById(id) {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const { data, error } = await supabase.from('master_unit').select('*').eq('id_master', id).limit(1).maybeSingle();
    if (error) throw error;
    return data;
}

export async function upsertMaster(id, payload) {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    if (id) {
        const { data, error } = await supabase.from('master_unit').update(payload).eq('id_master', id).select().limit(1).maybeSingle();
        if (error) throw error;
        return data;
    }
    const { data, error } = await supabase.from('master_unit').insert(payload).select().limit(1).maybeSingle();
    if (error) throw error;
    return data;
}
