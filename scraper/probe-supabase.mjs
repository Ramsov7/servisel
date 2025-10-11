import 'node:process';

async function probe() {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
        console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY) in env');
        process.exit(1);
    }

    const url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/master_unit?select=id&limit=1';
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                apikey: SERVICE_KEY,
                Authorization: 'Bearer ' + SERVICE_KEY,
                Accept: 'application/json'
            }
        });
        const text = await res.text();
        console.log('status', res.status);
        try { console.log('body', JSON.parse(text)); } catch (e) { console.log('body', text); }
    } catch (e) {
        console.error('probe error', e && e.message ? e.message : e);
    }
}

probe();
