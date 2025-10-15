/* pembelianApiDb.js — adapter for pembelian_sparepart and pembelian_detail
   Exposes: window.pembelianApiDb
*/

(function () {
    function getSup() { return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null); }

    const adapter = {
        listPembelian: async (limit = 200) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            const candidates = ['pembelian_sparepart', 'pembelian'];
            for (const t of candidates) {
                try {
                    if (typeof window.tableExists === 'function') {
                        const ok = await window.tableExists(t, sup);
                        if (!ok) continue;
                    }
                    const res = await sup.from(t).select('*').order('tanggal_pembelian', { ascending: false }).limit(limit);
                    if (!res.error) return (res.data || []).map(r => Object.assign({}, r, { _table: t }));
                } catch (e) { /* try next */ }
            }
            return [];
        },
        getPembelianById: async (id) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists('pembelian_sparepart', sup);
                if (!ok) return null;
            }
            const res = await sup.from('pembelian_sparepart').select('*').eq('id_pembelian', id).limit(1).single();
            if (res && !res.error) return res.data;
            return null;
        },
        createPembelian: async (payload) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists('pembelian_sparepart', sup);
                if (!ok) throw new Error('pembelian_sparepart table not available');
            }
            const res = await sup.from('pembelian_sparepart').insert([payload]).select();
            if (res.error) throw res.error;
            return res.data && res.data[0];
        },
        addPembelianDetail: async (payload) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready');
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists('pembelian_detail', sup);
                if (!ok) throw new Error('pembelian_detail table not available');
            }
            const res = await sup.from('pembelian_detail').insert([payload]).select();
            if (res.error) throw res.error;
            return res.data && res.data[0];
        }
    };

    if (typeof window !== 'undefined') window.pembelianApiDb = adapter;
    return adapter;
})();
