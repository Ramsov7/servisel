/* supplierApiDb.js — adapter for supplier table
   Exposes window.supplierApiDb
*/

(function () {
    function getSup() { return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null); }
    const table = 'supplier';
    const adapter = {
        listSupplier: async (limit = 200) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists(table, sup);
                if (!ok) return [];
            }
            const { data, error } = await sup.from(table).select('*').order('created_at', { ascending: false }).limit(limit);
            if (error) throw error;
            return data || [];
        },
        createSupplier: async (payload) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists(table, sup);
                if (!ok) throw new Error('supplier table not available');
            }
            const { data, error } = await sup.from(table).insert([payload]).select();
            if (error) throw error;
            return data && data[0];
        }
    };

    if (typeof window !== 'undefined') window.supplierApiDb = adapter;
    return adapter;
})();
