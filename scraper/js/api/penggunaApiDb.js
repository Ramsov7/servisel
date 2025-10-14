/* penggunaApiDb.js — adapter for pengguna (users)
   Exposes window.penggunaApiDb
*/

(function () {
    function getSup() { return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null); }
    const table = 'pengguna';
    const adapter = {
        listPengguna: async (limit = 200) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists(table, sup);
                if (!ok) return [];
            }
            const { data, error } = await sup.from(table).select('*').order('created_at', { ascending: false }).limit(limit);
            if (error) throw error;
            return data || [];
        },
        getPenggunaById: async (id) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists(table, sup);
                if (!ok) return null;
            }
            const { data, error } = await sup.from(table).select('*').eq('id_pengguna', id).limit(1).single();
            if (error) throw error;
            return data || null;
        },
        createPengguna: async (payload) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists(table, sup);
                if (!ok) throw new Error('pengguna table not available');
            }
            const { data, error } = await sup.from(table).insert([payload]).select();
            if (error) throw error;
            return data && data[0];
        }
    };

    if (typeof window !== 'undefined') window.penggunaApiDb = adapter;
    return adapter;
})();
