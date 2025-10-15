/* sparepartApi.js — wrapper that exposes DB-centric API names for sparepart table
   This file provides a stable API using DB field names (id_sparepart, nama_sparepart, etc.)
   and keeps backward compatibility by delegating to existing implementations when available.
*/

(function () {
    function getImpl() {
        // Prefer existing new-schema implementation if present
        if (typeof window !== 'undefined' && window.itemsApiNew) return window.itemsApiNew;
        // Fallback: use legacy itemsApi but adapt names
        if (typeof window !== 'undefined' && window.itemsApi) {
            // Create adapter around itemsApi
            return {
                listSparepart: async (limit) => {
                    const rows = await window.itemsApi.listItems();
                    return (rows || []).map(r => r._raw || r);
                },
                getSparepartById: async (id) => {
                    // try to resolve via itemsApi resolveSparepartIdByCode or list
                    const list = await window.itemsApi.listItems();
                    const found = (list || []).find(r => (r.id === id || r.item_code === id || r.kode_item === id));
                    return found ? (found._raw || found) : null;
                },
                createSparepart: async (body) => {
                    // adapt to legacy addItem
                    const payload = {
                        kode_item: body.kode_sparepart || body.kode_item,
                        nama_item: body.nama_sparepart || body.nama_item || body.nama,
                        stok_item: body.stok ?? body.stok_item ?? 0,
                        jasa_item: body.harga_jual ?? body.jasa_item ?? null,
                        lokasi: body.lokasi_penyimpanan || body.lokasi || null,
                        catatan: body.catatan || null,
                        image_url: body.image_url || null
                    };
                    return await window.itemsApi.addItem(payload);
                },
                updateSparepart: async (id, changes) => {
                    // map changes to legacy shape where reasonable
                    const payload = Object.assign({}, changes);
                    if ('nama_sparepart' in changes) payload.nama_item = changes.nama_sparepart;
                    if ('kode_sparepart' in changes) payload.kode_item = changes.kode_sparepart;
                    if ('stok' in changes) payload.stok_item = changes.stok;
                    if ('harga_jual' in changes) payload.jasa_item = changes.harga_jual;
                    return await window.itemsApi.updateItem(id, payload);
                },
                deleteSparepart: async (id) => {
                    return await window.itemsApi.deleteItem(id);
                }
            };
        }
        return null;
    }

    const impl = getImpl();
    const exposed = impl || {
        listSparepart: async () => { throw new Error('No sparepart API implementation available'); },
        getSparepartById: async () => { throw new Error('No sparepart API implementation available'); },
        createSparepart: async () => { throw new Error('No sparepart API implementation available'); },
        updateSparepart: async () => { throw new Error('No sparepart API implementation available'); },
        deleteSparepart: async () => { throw new Error('No sparepart API implementation available'); }
    };

    if (typeof window !== 'undefined') {
        window.sparepartApi = exposed;
        // keep legacy alias for compatibility if itemsApiNew not present
        if (!window.itemsApiNew) window.itemsApiNew = exposed;
    }

    return exposed;
})();
