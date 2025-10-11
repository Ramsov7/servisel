/* jasaApi.new.js — new-schema-only API for jasa table (new schema)
   Exposes: listJasaNew, getJasaById, createJasa, updateJasa, deleteJasa
   New-shaped objects: id_jasa, nama_jasa, tarif, deskripsi, kategori, garansi_hari
*/

const jasaApiNew = (function () {
    const table = 'jasa';
    function getSafe() { return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null); }

    function mapRow(row) {
        if (!row) return null;
        return Object.assign({}, row, {
            id_jasa: row.id_jasa || null,
            nama_jasa: row.nama_jasa || row.nama || null,
            tarif: Number(row.tarif || 0),
            deskripsi: row.deskripsi || null,
            kategori: row.kategori || null,
            garansi_hari: row.garansi_hari || 0,
            created_at: row.created_at || null,
            updated_at: row.updated_at || null,
            _raw: row
        });
    }

    async function listJasaNew(limit = 500) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (jasaApiNew.listJasaNew)');
        const { data, error } = await sup.from(table).select('*').order('nama_jasa', { ascending: true }).limit(limit);
        if (error) throw error;
        return (data || []).map(mapRow);
    }

    async function getJasaById(id) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (jasaApiNew.getJasaById)');
        const { data, error } = await sup.from(table).select('*').eq('id_jasa', id).limit(1).single();
        if (error) throw error;
        return mapRow(data);
    }

    async function createJasa(body) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (jasaApiNew.createJasa)');
        const { data, error } = await sup.from(table).insert([body]).select();
        if (error) throw error;
        return mapRow(data && data.length ? data[0] : data);
    }

    async function updateJasa(id, changes) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (jasaApiNew.updateJasa)');
        const { data, error } = await sup.from(table).update(changes).eq('id_jasa', id).select();
        if (error) throw error;
        return mapRow(data && data.length ? data[0] : data);
    }

    async function deleteJasa(id) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (jasaApiNew.deleteJasa)');
        const { error } = await sup.from(table).delete().eq('id_jasa', id);
        if (error) throw error;
        return true;
    }

    const exposed = { listJasaNew, getJasaById, createJasa, updateJasa, deleteJasa };
    if (typeof window !== 'undefined') window.jasaApiNew = exposed;
    return exposed;
})();
