import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const id = process.argv[2] || 'f2269c75-5b4e-4ddd-b1e4-8225a87d13b7';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_KEY env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function run() {
    const { data, error } = await supabase.from('master_unit').select('*').eq('id_master', id).limit(1).maybeSingle();
    if (error) {
        console.error('Error', error);
        process.exit(1);
    }
    console.log(JSON.stringify(data, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });