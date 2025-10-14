/**
 * supabaseClient.js
 * Inisialisasi Supabase client dan helper kecil untuk akses yang lebih aman.
 * Tujuan: beri titik pusat inisialisasi sehingga file API lain tidak perlu
 * mengulang logika pemeriksaan atau mereferensikan `window.supabase` tanpa cek.
 */

// Nilai ini di-hardcode karena ini aplikasi client-side kecil. Jika ingin
// meningkatkan keamanan, pindahkan ke server atau environment yang lebih aman.
// Perubahan: aplikasi diarahkan ke project `servisel_db` (baru).
const SUPABASE_URL = "https://zfppkxvlpuisxmhdtmeu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmcHBreHZscHVpc3htaGR0bWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNjQyODcsImV4cCI6MjA3NTY0MDI4N30.l1kg-2UyeLmmaEt7dXedIiEwxM5RGw3yEDyBoiKKoTE";

/**
 * createSupabaseIfNeeded - buat client Supabase dan lampirkan ke window jika SDK sudah dimuat.
 * Fungsi ini idempotent dan dapat dipanggil berkali-kali.
 */
function createSupabaseIfNeeded() {
    try {
        if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
            // Jika window.supabase belum berisi Supabase client (memiliki method `from`), buat dan set.
            // Perhatikan: CDN meng-expose objek `supabase` yang berisi helper (createClient).
            // Jika kita langsung memeriksa `window.supabase` kita mungkin melihat objek library,
            // bukan client; periksa keberadaan method `from` untuk memastikan ini adalah client.
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
            return window.supabase;
        }
    } catch (e) {
        // defensive: log untuk developer, teruskan agar aplikasi tidak crash
        console.warn('Gagal mengakses objek supabase global:', e);
    }
    return null;
}


// Jika SDK sudah tersedia saat script dieksekusi, buat client segera.
createSupabaseIfNeeded();

// If SDK not available immediately, poll briefly (tolerate slow CDN) before warning.
function waitForSupabaseSDK({ timeout = 5000, interval = 200 } = {}) {
    const start = Date.now();
    return new Promise((resolve) => {
        function check() {
            // If global `supabase` library exists and has createClient, create client
            if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
                const client = createSupabaseIfNeeded();
                return resolve(client);
            }
            // If window.supabase already holds a client (has .from), resolve
            if (window.supabase && typeof window.supabase.from === 'function') return resolve(window.supabase);
            if (Date.now() - start > timeout) return resolve(null);
            setTimeout(check, interval);
        }
        check();
    });
}

// Start polling on load to tolerate slow CDN/network. Only warn if polling timed out.
window.addEventListener('load', async () => {
    const client = await waitForSupabaseSDK({ timeout: 5000, interval: 200 });
    if (!client) console.warn('Supabase SDK tidak tersedia setelah load. Pastikan <script> CDN dimuat dan tidak diblokir.');
    // Allow REST fallback probes after initial load/Supabase readiness attempt.
    try { window._allowTableRestProbe = true; } catch (e) { /* ignore */ }
});

// Utility other modules can use to ensure supabase is ready (returns client or throws)
async function ensureSupabaseReady(timeout = 5000) {
    const client = await waitForSupabaseSDK({ timeout, interval: 200 });
    if (!client) throw new Error('Supabase SDK tidak tersedia. Periksa koneksi atau pemblokiran CDN.');
    return client;
}

if (typeof window !== 'undefined') window.ensureSupabaseReady = ensureSupabaseReady;

/**
 * getSupabase - helper untuk API lain agar mendapat instance supabase atau
 * menghasilkan error yang jelas bila belum diinisialisasi.
 */
function getSupabase() {
    if (!window.supabase) throw new Error('Supabase client belum diinisialisasi.');
    return window.supabase;
}

// expose helper ke window agar modul lama bisa memanggilnya untuk pemeriksaan singkat
if (typeof window !== 'undefined') window.getSupabase = getSupabase;

// Lightweight table existence cache + helper available to other modules.
const _tableExistsCache_global = {};
async function tableExists(table, sup) {
    try {
        const client = sup || (typeof getSupabase === 'function' ? (function () { try { return getSupabase(); } catch (e) { return (window.supabase && typeof window.supabase.from === 'function') ? window.supabase : null; } })() : (window.supabase || null));
        if (table in _tableExistsCache_global) return _tableExistsCache_global[table];
        if (client && typeof client.from === 'function') {
            try {
                // Use select('*') which is safe for any table schema. Selecting a
                // literal like '1' can trigger PostgREST 400 on some setups.
                const probe = await client.from(table).select('*').limit(1);
                const ok = !(probe && probe.error);
                _tableExistsCache_global[table] = ok;
                return ok;
            } catch (e) {
                _tableExistsCache_global[table] = false;
                return false;
            }
        }

        // If Supabase client not ready, optionally perform a safe fetch to REST endpoint.
        // Avoid REST fallback during the initial load phase unless explicitly allowed
        // by the load handler. Also skip if the browser is offline.
        try {
            if (typeof window !== 'undefined' && window._allowTableRestProbe === false) {
                _tableExistsCache_global[table] = false;
                return false;
            }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                _tableExistsCache_global[table] = false;
                return false;
            }
            // Use apikey as URL param to avoid sending custom Authorization header which
            // often triggers CORS preflight; Supabase accepts apikey as query param.
            // Use select=* (encoded) and include apikey as query param to authenticate
            const urlBase = SUPABASE_URL.replace(/\/$/, '') + `/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent('*')}&limit=1`;
            const url = urlBase + `&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;
            const res = await fetch(url, {
                method: 'GET',
                // Keep headers minimal to avoid CORS preflight; Accept is safe.
                headers: {
                    'Accept': 'application/json'
                },
                // avoid sending credentials
                credentials: 'omit'
            });
            const ok = res && res.status >= 200 && res.status < 300;
            _tableExistsCache_global[table] = ok;
            return ok;
        } catch (e) {
            _tableExistsCache_global[table] = false;
            return false;
        }
    } catch (e) {
        return false;
    }
}

if (typeof window !== 'undefined') window.tableExists = tableExists;
// Disable REST fallback by default until load handler toggles it. This prevents
// noisy fetches during initial hard reload if the network or CDN is slow/unavailable.
if (typeof window !== 'undefined' && typeof window._allowTableRestProbe === 'undefined') window._allowTableRestProbe = false;

// NOTE: You exposed the anon/service keys in this workspace. After you've
// validated the app against `servisel_db`, rotate the keys in Supabase
// dashboard (Settings → API) to avoid leaving credentials published.
