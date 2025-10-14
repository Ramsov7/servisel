/* unitsApiDb.js — DB-centric adapter for unit/master_unit related operations
   Exposes window.unitsApiDb and aliases when possible.
*/

(function () {
    function getSup() { return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null); }

    const adapter = {
        listUnits: async (limit = 500) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready (unitsApiDb.listUnits)');
            // try table candidates in order
            const candidates = ['unit', 'master_unit'];
            for (const t of candidates) {
                try {
                    if (typeof window.tableExists === 'function') {
                        const ok = await window.tableExists(t, sup);
                        if (!ok) continue;
                    }
                    const res = await sup.from(t).select('*').limit(limit);
                    if (!res.error) return (res.data || []).map(r => Object.assign({}, r, { _table: t }));
                } catch (e) { /* ignore and try next */ }
            }
            throw new Error('No units table found');
        },
        getUnitById: async (id) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready (unitsApiDb.getUnitById)');
            const candidates = ['unit', 'master_unit', 'units'];
            for (const t of candidates) {
                try {
                    if (typeof window.tableExists === 'function') {
                        const ok = await window.tableExists(t, sup);
                        if (!ok) continue;
                    }
                    const { data, error } = await sup.from(t).select('*').eq('id_unit', id).limit(1).single();
                    if (!error && data) return Object.assign({}, data, { _table: t });
                } catch (e) { /* ignore */ }
            }
            return null;
        },
        createUnit: async (payload) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready (unitsApiDb.createUnit)');
            const candidates = ['unit', 'master_unit', 'units'];
            // prefer non-master for create
            const insertOrder = candidates.filter(t => t !== 'master_unit').concat('master_unit');
            let lastErr = null;
            for (const t of insertOrder) {
                try {
                    if (typeof window.tableExists === 'function') {
                        const ok = await window.tableExists(t, sup);
                        if (!ok) continue;
                    }
                    const { data, error } = await sup.from(t).insert([payload]).select();
                    if (!error) return Object.assign({}, (data && data[0]) || data, { _table: t });
                    lastErr = error;
                } catch (e) { lastErr = e; }
            }
            throw lastErr || new Error('createUnit failed');
        },
        // Transactional RPC: insert unit and optionally record pembelian in single DB transaction
        createUnitWithPembelian: async (unitPayload, pembPayload = null) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready (unitsApiDb.createUnitWithPembelian)');
            try {
                // pass JSON objects to RPC; Supabase JS will stringify automatically
                const params = { unit_json: unitPayload || {}, pemb_json: pembPayload || null };
                const { data, error } = await sup.rpc('add_unit_and_pembelian', params);
                if (error) throw error;
                // data is likely an array or object depending on PostgREST/Supabase behavior
                return Array.isArray(data) ? data[0] : data;
            } catch (e) {
                throw new Error('createUnitWithPembelian failed: ' + (e && e.message ? e.message : String(e)));
            }
        },
        updateUnit: async (id, changes) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready (unitsApiDb.updateUnit)');
            const candidates = ['unit', 'master_unit', 'units'];
            for (const t of candidates) {
                try {
                    if (typeof window.tableExists === 'function') {
                        const ok = await window.tableExists(t, sup);
                        if (!ok) continue;
                    }
                    const { data, error } = await sup.from(t).update(changes).eq('id_unit', id).select();
                    if (!error && data && data.length) return Object.assign({}, data[0], { _table: t });
                } catch (e) { /* ignore */ }
            }
            throw new Error('updateUnit failed or id not found');
        },
        deleteUnit: async (id) => {
            const sup = getSup(); if (!sup) throw new Error('Supabase client not ready (unitsApiDb.deleteUnit)');
            const candidates = ['unit', 'master_unit', 'units'];
            for (const t of candidates) {
                try {
                    if (typeof window.tableExists === 'function') {
                        const ok = await window.tableExists(t, sup);
                        if (!ok) continue;
                    }
                    const { error } = await sup.from(t).delete().eq('id_unit', id);
                    if (!error) return true;
                } catch (e) { /* ignore */ }
            }
            throw new Error('deleteUnit failed or id not found');
        }
    };

    if (typeof window !== 'undefined') {
        window.unitsApiDb = adapter;
    }

    return adapter;
})();
