import { supabase, isSupabaseConfigured } from './supabase.js';

async function list() {
    if (!isSupabaseConfigured) {
        console.error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY env vars.');
        process.exit(1);
    }
    try {
        const { data, error } = await supabase.from('master_unit').select('*').order('created_at', { ascending: false }).limit(10);
        if (error) throw error;
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error querying master_unit:', e.message || e);
    }
}

list();
