/* itemsApi.new.js — new-schema-only API for sparepart table
   Exposes: listSparepart, getSparepart, createSparepart, updateSparepart, deleteSparepart
   Returns/accepts new-shaped objects: id_sparepart, nama_sparepart, kode_sparepart, stok, harga_beli, harga_jual, kategori
*/

const itemsApiNew = (function () {
    const table = 'sparepart';

    function getSafe() { return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null); }

    function mapRow(row) {
        if (!row) return null;
        return Object.assign({}, row, {
            id_sparepart: row.id_sparepart || row.id || null,
            nama_sparepart: row.nama_sparepart || row.nama || null,
            kode_sparepart: row.kode_sparepart || null,
            stok: Number(row.stok || 0),
            harga_beli: row.harga_beli ?? null,
            harga_jual: row.harga_jual ?? null,
            kategori: row.kategori || null,
            lokasi_penyimpanan: row.lokasi_penyimpanan || null,
            created_at: row.created_at || null,
            updated_at: row.updated_at || null,
            _raw: row
        });
    }

    async function listSparepart(limit = 1000) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (itemsApiNew.listSparepart)');
        // Only query if table exists to avoid 404 errors in Console
        try {
            const exists = (typeof tableExists === 'function') ? await tableExists(table, sup) : true;
            if (!exists) return [];
        } catch (e) { /* ignore and attempt query */ }
        const { data, error } = await sup.from(table).select('*').order('nama_sparepart', { ascending: true }).limit(limit);
        if (error) throw error;
        return (data || []).map(mapRow);
    }

    async function getSparepartById(id) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (itemsApiNew.getSparepartById)');
        try {
            const exists = (typeof tableExists === 'function') ? await tableExists(table, sup) : true;
            if (!exists) return null;
        } catch (e) { /* ignore */ }
        const { data, error } = await sup.from(table).select('*').eq('id_sparepart', id).limit(1).single();
        if (error) throw error;
        return mapRow(data);
    }

    async function createSparepart(body) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (itemsApiNew.createSparepart)');
        try {
            const exists = (typeof tableExists === 'function') ? await tableExists(table, sup) : true;
            if (!exists) throw new Error('Tabel ' + table + ' tidak ditemukan di database');
        } catch (e) { /* continue to attempt insert and let Supabase return error if any */ }
        const { data, error } = await sup.from(table).insert([body]).select();
        if (error) throw error;
        return mapRow(data && data.length ? data[0] : data);
    }

    async function updateSparepart(id, changes) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (itemsApiNew.updateSparepart)');
        try {
            const exists = (typeof tableExists === 'function') ? await tableExists(table, sup) : true;
            if (!exists) throw new Error('Tabel ' + table + ' tidak ditemukan di database');
        } catch (e) { /* ignore */ }
        const { data, error } = await sup.from(table).update(changes).eq('id_sparepart', id).select();
        if (error) throw error;
        return mapRow(data && data.length ? data[0] : data);
    }

    async function deleteSparepart(id) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (itemsApiNew.deleteSparepart)');
        try {
            const exists = (typeof tableExists === 'function') ? await tableExists(table, sup) : true;
            if (!exists) throw new Error('Tabel ' + table + ' tidak ditemukan di database');
        } catch (e) { /* ignore */ }
        const { error } = await sup.from(table).delete().eq('id_sparepart', id);
        if (error) throw error;
        return true;
    }

    const exposed = { listSparepart, getSparepartById, createSparepart, updateSparepart, deleteSparepart };
    if (typeof window !== 'undefined') window.itemsApiNew = exposed;
    return exposed;
})();
