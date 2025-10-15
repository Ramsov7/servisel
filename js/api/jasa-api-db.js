/* jasaApiDb.js — expose DB-centric API names for jasa table
   Provides: window.jasaApiDb (id_jasa, nama_jasa, tarif, deskripsi, kategori, garansi_hari)
   Keeps compatibility by delegating to existing `jasaApi` when necessary.
*/

(function () {
    const impl = (typeof window !== 'undefined' && window.jasaApiNew) ? window.jasaApiNew : ((typeof window !== 'undefined' && window.jasaApi) ? window.jasaApi : null);

    const adapter = {
        listJasa: async (limit = 500) => {
            if (!impl) throw new Error('No jasa implementation available');
            if (impl.listJasaNew) return impl.listJasaNew(limit);
            if (impl.listJasa) return impl.listJasa(limit);
            // last-resort: try generic list
            if (impl.list) return impl.list(limit);
            throw new Error('jasa list function not found');
        },
        getJasaById: async (id) => {
            if (!impl) throw new Error('No jasa implementation available');
            if (impl.getJasaById) return impl.getJasaById(id);
            if (impl.getJasaByID) return impl.getJasaByID(id);
            // fallback: search list
            const all = await adapter.listJasa(1000);
            return (all || []).find(r => r.id_jasa === id || r.kode_jasa === id) || null;
        },
        createJasa: async (body) => {
            if (!impl) throw new Error('No jasa implementation available');
            if (impl.createJasa) return impl.createJasa(body);
            if (impl.addJasa) return impl.addJasa(body);
            throw new Error('createJasa not available');
        },
        updateJasa: async (id, changes) => {
            if (!impl) throw new Error('No jasa implementation available');
            if (impl.updateJasa) return impl.updateJasa(id, changes);
            throw new Error('updateJasa not available');
        },
        deleteJasa: async (id) => {
            if (!impl) throw new Error('No jasa implementation available');
            if (impl.deleteJasa) return impl.deleteJasa(id);
            throw new Error('deleteJasa not available');
        }
    };

    if (typeof window !== 'undefined') {
        window.jasaApiDb = adapter;
        // ensure a canonical alias exists for new-style callers
        if (!window.jasaApiNew) window.jasaApiNew = adapter;
    }

    return adapter;
})();
