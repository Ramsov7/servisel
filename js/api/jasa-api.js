/* jasaApi.js — wrapper for jasa/service catalog */

/**
 * jasaApi: simple CRUD wrapper untuk tabel `jasa`.
 * Menggunakan helper `getSupabase()` dari `supabaseClient.js` untuk pemeriksaan
 * bahwa SDK sudah tersedia sebelum melakukan panggilan.
 */
const jasaApi = (function () {
    // New table name
    const tableNew = 'jasa';
    const tableOld = 'jasa';

    function getSafe() {
        return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
    }

    function mapFromJasa(row) {
        if (!row) return null;
        return {
            // provide legacy keys expected by UI
            kode_jasa: row.kode_jasa || row.id_jasa || null,
            id_jasa: row.id_jasa || null,
            nama: row.nama || row.nama_jasa || null,
            nama_jasa: row.nama_jasa || row.nama || null,
            harga: row.harga || row.tarif || null,
            tarif: row.tarif || row.harga || null,
            deskripsi: row.deskripsi || null,
            kategori: row.kategori || null,
            aktif: typeof row.aktif === 'boolean' ? row.aktif : (row.aktif === undefined ? true : Boolean(row.aktif)),
            _raw: row
        };
    }

    async function listJasa(limit = 200) {
        const sup = getSafe();
        if (!sup) throw new Error('Supabase client belum siap (jasaApi.listJasa)');
        // Try new schema fields first
        try {
            // avoid probing if table doesn't exist
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists(tableNew, sup);
                if (!ok) return [];
            }
            const { data, error } = await sup.from(tableNew).select('*').order('nama_jasa', { ascending: true }).limit(limit);
            if (error) throw error;
            return (data || []).map(mapFromJasa);
        } catch (e) {
            // fallback: attempt to read legacy-shaped rows
            try {
                if (typeof window.tableExists === 'function') {
                    const okOld = await window.tableExists(tableOld, sup);
                    if (!okOld) return [];
                }
                const { data, error } = await sup.from(tableOld).select('*').order('nama', { ascending: true }).limit(limit);
                if (error) throw error;
                return (data || []).map(mapFromJasa);
            } catch (err) {
                throw new Error('jasaApi.listJasa: ' + (err.message || JSON.stringify(err)));
            }
        }
    }

    async function addJasa(payload) {
        if (!payload || typeof payload !== 'object') throw new TypeError('payload object diperlukan untuk addJasa');
        const sup = getSafe();
        if (!sup) throw new Error('Supabase client belum siap (jasaApi.addJasa)');

        // Normalize incoming payload to new schema
        const body = {
            nama_jasa: payload.nama || payload.nama_jasa || null,
            tarif: payload.harga ?? payload.tarif ?? 0,
            deskripsi: payload.deskripsi ?? null,
            kategori: payload.kategori ?? null,
            aktif: typeof payload.aktif !== 'undefined' ? payload.aktif : true,
            created_at: new Date().toISOString()
        };

        // Try inserting into new table. If DB complains about missing 'aktif' column
        // or other schema mismatch (400), retry without 'aktif' field and finally
        // fallback to legacy-shaped insert.
        try {
            const { data, error } = await sup.from(tableNew).insert([body]).select();
            if (!error) return mapFromJasa(data && data.length ? data[0] : data);
            // If error but not a schema issue, throw to fallback below
            throw error;
        } catch (e) {
            // If error mentions 'aktif' or schema cache, try again without 'aktif'
            const msg = (e && e.message) ? e.message.toString().toLowerCase() : '';
            if (msg.includes('aktif') || msg.includes('could not find') || msg.includes('column') || (e && e.code === '42883') || (e && e.status === 400)) {
                try {
                    const bodyNoAktif = Object.assign({}, body);
                    delete bodyNoAktif.aktif;
                    const { data: d2, error: err2 } = await sup.from(tableNew).insert([bodyNoAktif]).select();
                    if (!err2) return mapFromJasa(d2 && d2.length ? d2[0] : d2);
                    // else fallthrough to legacy
                } catch (e2) {
                    // continue to legacy fallback
                }
            }
            // fallback to inserting legacy-shaped row
            try {
                const legacy = {
                    nama: payload.nama || payload.nama_jasa || null,
                    harga: payload.harga ?? payload.tarif ?? 0,
                    deskripsi: payload.deskripsi ?? null,
                    kategori: payload.kategori ?? null
                };
                // include aktif only if provided to avoid schema errors on legacy/new mix
                if (typeof payload.aktif !== 'undefined') legacy.aktif = payload.aktif;
                const { data: d3, error: err3 } = await sup.from(tableOld).insert([legacy]).select();
                if (err3) throw err3;
                return mapFromJasa(d3 && d3.length ? d3[0] : d3);
            } catch (err) {
                throw new Error('jasaApi.addJasa: ' + (err.message || JSON.stringify(err)));
            }
        }
    }

    async function updateJasa(key, payload) {
        if (!key) throw new TypeError('updateJasa memerlukan key (kode_jasa)');
        const sup = getSafe();
        if (!sup) throw new Error('Supabase client belum siap (jasaApi.updateJasa)');

        // Try update by id_jasa first, then kode_jasa, then legacy kode_jasa
        try {
            if (typeof key === 'string' && key.includes('-')) {
                const { data, error } = await sup.from(tableNew).update({ nama_jasa: payload.nama, tarif: payload.harga, deskripsi: payload.deskripsi, kategori: payload.kategori, aktif: payload.aktif }).eq('id_jasa', key).select();
                if (!error && data && data.length) return mapFromJasa(data[0]);
            }
            const { data, error } = await sup.from(tableNew).update({ nama_jasa: payload.nama, tarif: payload.harga, deskripsi: payload.deskripsi, kategori: payload.kategori, aktif: payload.aktif }).eq('kode_jasa', key).select();
            if (!error && data && data.length) return mapFromJasa(data[0]);
        } catch (e) { /* ignore and fallback */ }

        // fallback to legacy update
        try {
            const { data, error } = await sup.from(tableOld).update({ nama: payload.nama, harga: payload.harga, deskripsi: payload.deskripsi, kategori: payload.kategori, aktif: payload.aktif }).eq('kode_jasa', key).select();
            if (error) throw error;
            return mapFromJasa(data && data.length ? data[0] : data);
        } catch (err) {
            throw new Error('jasaApi.updateJasa: ' + (err.message || JSON.stringify(err)));
        }
    }

    async function deleteJasa(key) {
        if (!key) throw new TypeError('deleteJasa memerlukan key (kode_jasa)');
        const sup = getSafe();
        if (!sup) throw new Error('Supabase client belum siap (jasaApi.deleteJasa)');
        try {
            // try id_jasa
            if (typeof key === 'string' && key.includes('-')) {
                const { error } = await sup.from(tableNew).delete().eq('id_jasa', key);
                if (!error) return true;
            }
            const { error } = await sup.from(tableNew).delete().eq('kode_jasa', key);
            if (!error) return true;
        } catch (e) { /* ignore and fallback */ }
        // fallback to legacy
        try {
            const { error } = await sup.from(tableOld).delete().eq('kode_jasa', key);
            if (error) throw error;
            return true;
        } catch (err) {
            throw new Error('jasaApi.deleteJasa: ' + (err.message || JSON.stringify(err)));
        }
    }

    const exposed = { listJasa, addJasa, updateJasa, deleteJasa };
    // expose globally for UI modules
    if (typeof window !== 'undefined') window.jasaApi = exposed;
    return exposed;
})();
