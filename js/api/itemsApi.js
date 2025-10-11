/* itemsApi.js — wrapper around Supabase queries for items */

/**
 * itemsApi.js
 * Wrapper sederhana untuk operasi CRUD terhadap tabel `items`.
 * - Selalu menggunakan `getSupabase()` yang didefinisikan di `supabaseClient.js` untuk pemeriksaan yang aman.
 * - Mengekspos objek ke `window.itemsApi` agar modul UI lama tetap berfungsi.
 */
const itemsApi = (function () {
    // Internally prefer the new `sparepart` table (skema terbaru). Keep returning
    // legacy-shaped objects to avoid changing the UI.
    const tableNew = 'sparepart';
    // legacy fallback table name removed to avoid noisy probes in projects
    // that only use the new schema. If you need legacy fallback, re-enable
    // by setting tableOld = 'items'.
    const tableOld = null;

    function mapFromSparepart(row) {
        if (!row) return null;
        // Map new sparepart fields to legacy shape expected by UI
        return {
            id: row.id_sparepart || row.id || null,
            kode_item: row.kode_sparepart || null,
            item_code: row.kode_sparepart || null,
            nama_item: row.nama_sparepart || row.nama || null,
            name: row.nama_sparepart || row.nama || null,
            stok_item: Number((row.stok !== undefined && row.stok !== null) ? row.stok : (row.stock !== undefined && row.stock !== null ? row.stock : 0)),
            stock: Number((row.stock !== undefined && row.stock !== null) ? row.stock : (row.stok !== undefined && row.stok !== null ? row.stok : 0)),
            jasa_item: Number((row.harga_jual !== undefined && row.harga_jual !== null) ? row.harga_jual : (row.sale_price !== undefined && row.sale_price !== null ? row.sale_price : 0)),
            cost_price: row.harga_beli ?? null,
            sale_price: row.harga_jual ?? null,
            kategori_item: row.kategori || null,
            sumber_item: row.lokasi_penyimpanan || row.sumber || null,
            informasi_tambahan_item: row.catatan || null,
            image_url: row.image_url || row.foto || null,
            // keep original raw row for debugging if needed
            _raw: row
        };
    }

    // Prefer centralized tableExists helper if provided by supabaseClient.js
    async function tableExists(sup, table) {
        try {
            if (typeof window.tableExists === 'function') return await window.tableExists(table, sup);
        } catch (e) { /* fall through to local probe */ }
        // Local fallback cache to avoid repeated probes when global helper unavailable
        const _tableExistsCacheLocal = tableExists._cache || (tableExists._cache = {});
        try {
            if (table in _tableExistsCacheLocal) return _tableExistsCacheLocal[table];
            // Use select('*') for probe — selecting a literal (e.g. '1') can cause
            // PostgREST to return 400 on some configurations.
            const probe = await sup.from(table).select('*').limit(1);
            const ok = !(probe && probe.error);
            _tableExistsCacheLocal[table] = ok;
            return ok;
        } catch (e) {
            _tableExistsCacheLocal[table] = false;
            return false;
        }
    }

    async function listItems() {
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client belum siap (itemsApi.listItems)');
        // Try new table first if it exists, fallback to old table
        try {
            if (await tableExists(sup, tableNew)) {
                const { data, error } = await sup.from(tableNew).select('*').order('nama_sparepart', { ascending: true }).limit(1000);
                if (!error && data && data.length) return data.map(mapFromSparepart);
                if (!error && (!data || data.length === 0)) return [];
            }
        } catch (e) { /* ignore and try fallback */ }

        // Do not attempt legacy `items` fallback by default to avoid
        // noisy 404 probes on projects that use `sparepart` + `unit`.
        // If legacy support is required, set `tableOld = 'items'` above.
        return [];
    }

    // Resolve a sparepart id by legacy kode or kode_sparepart/item_code
    async function resolveSparepartIdByCode(code) {
        if (!code) return null;
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) return null;
        // helper: detect UUID-like strings
        function isLikelyUUID(val) {
            if (!val || typeof val !== 'string') return false;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
        }
        // try new table if exists: prefer two small queries over .or(...) to avoid
        // malformed .or strings causing 400 errors for some inputs
        try {
            if (await tableExists(sup, tableNew)) {
                try {
                    const byKode = await sup.from(tableNew).select('id_sparepart,kode_sparepart').eq('kode_sparepart', code).limit(1);
                    if (!(byKode && byKode.error) && Array.isArray(byKode.data) && byKode.data.length) return byKode.data[0].id_sparepart || byKode.data[0].kode_sparepart || null;
                } catch (e) { /* ignore */ }
                // Only query id_sparepart by equality if the provided code looks like a UUID
                try {
                    if (isLikelyUUID(code)) {
                        const byId = await sup.from(tableNew).select('id_sparepart,kode_sparepart').eq('id_sparepart', code).limit(1);
                        if (!(byId && byId.error) && Array.isArray(byId.data) && byId.data.length) return byId.data[0].id_sparepart || byId.data[0].kode_sparepart || null;
                    }
                } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
        // try legacy table if exists (only if a legacy table name is configured)
        if (tableOld) {
            try {
                if (await tableExists(sup, tableOld)) {
                    try {
                        const byKode = await sup.from(tableOld).select('kode_item,item_code').eq('kode_item', code).limit(1);
                        if (!(byKode && byKode.error) && Array.isArray(byKode.data) && byKode.data.length) return byKode.data[0].kode_item || byKode.data[0].item_code || null;
                    } catch (e) { /* ignore */ }
                    try {
                        const byItemCode = await sup.from(tableOld).select('kode_item,item_code').eq('item_code', code).limit(1);
                        if (!(byItemCode && byItemCode.error) && Array.isArray(byItemCode.data) && byItemCode.data.length) return byItemCode.data[0].kode_item || byItemCode.data[0].item_code || null;
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    async function addItem(payload) {
        if (!payload || typeof payload !== 'object') throw new TypeError('payload object diperlukan untuk addItem');
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client belum siap (itemsApi.addItem)');

        // Normalize incoming payload: accept legacy keys (kode_item, nama_item, stok_item, jasa_item)
        const p = Object.assign({}, payload);
        const kode = p.kode_item || p.item_code || p.kode_sparepart || null;
        const nama = p.nama_item || p.name || p.nama_sparepart || p.nama || null;
        const stok = ('stok_item' in p) ? Number(p.stok_item) : (('stock' in p) ? Number(p.stock) : 0);
        const harga = ('jasa_item' in p) ? Number(p.jasa_item) : (('harga_jual' in p) ? Number(p.harga_jual) : null);

        // Prefer inserting into new `sparepart` table if available
        try {
            const bodyNew = {
                kode_sparepart: kode || undefined,
                nama_sparepart: nama || undefined,
                stok: isNaN(stok) ? 0 : stok,
                harga_beli: p.harga_beli ?? p.cost_price ?? undefined,
                harga_jual: harga ?? p.sale_price ?? undefined,
                kategori: p.jenis_item || p.kategori || undefined,
                lokasi_penyimpanan: p.sumber_item || p.lokasi || undefined,
                created_at: new Date().toISOString()
            };
            const { data, error } = await sup.from(tableNew).insert([bodyNew]).select();
            if (!error && data && data.length) return mapFromSparepart(data[0]);
        } catch (e) {
            // fallback to legacy
        }

        // Fallback: insert into legacy `items` table
        try {
            const bodyOld = Object.assign({}, payload);
            if (kode && !bodyOld.kode_item) bodyOld.kode_item = kode;
            if (nama && !bodyOld.nama_item) bodyOld.nama_item = nama;
            if (typeof stok !== 'undefined' && !('stok_item' in bodyOld)) bodyOld.stok_item = stok;
            const { data, error } = await sup.from(tableOld).insert([bodyOld]).select();
            if (error) throw error;
            return (data && data.length) ? Object.assign({}, data[0], { item_code: data[0].item_code || data[0].kode_item }) : null;
        } catch (err) {
            throw new Error('itemsApi.addItem: ' + (err.message || JSON.stringify(err)));
        }
    }

    async function updateItem(id, changes) {
        if (!id) throw new TypeError('updateItem memerlukan id/kode_item sebagai parameter pertama');
        if (!changes || typeof changes !== 'object') throw new TypeError('updateItem memerlukan objek perubahan sebagai parameter kedua');
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client belum siap (itemsApi.updateItem)');

        // Try to resolve as sparepart id/code first
        try {
            // If id looks like a uuid (contains '-') assume it's id_sparepart
            const isUuid = typeof id === 'string' && id.includes('-');
            if (isUuid) {
                const { data, error } = await sup.from(tableNew).update(changes).eq('id_sparepart', id).select();
                if (!error && data && data.length) return mapFromSparepart(data[0]);
            }
            // Try matching by kode_sparepart
            const { data: byCode, error: byCodeErr } = await sup.from(tableNew).update(changes).eq('kode_sparepart', id).select();
            if (!byCodeErr && byCode && byCode.length) return mapFromSparepart(byCode[0]);
        } catch (e) { /* ignore and fallback */ }

        // Fallback to legacy table updates: update by kode_item or item_code
        try {
            const tryBy = async (col) => {
                const { data, error } = await sup.from(tableOld).update(changes).eq(col, id).select();
                if (error) throw error;
                return data && data.length ? data[0] : null;
            };
            const byNew = await tryBy('item_code');
            if (byNew) return byNew;
            return await tryBy('kode_item');
        } catch (err) {
            throw new Error('itemsApi.updateItem: ' + (err.message || JSON.stringify(err)));
        }
    }

    async function deleteItem(id) {
        if (!id) throw new TypeError('deleteItem memerlukan id/kode_item sebagai parameter');
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client belum siap (itemsApi.deleteItem)');

        // try new table deletions first (by id_sparepart or kode_sparepart)
        try {
            if (typeof id === 'string' && id.includes('-')) {
                const { error } = await sup.from(tableNew).delete().eq('id_sparepart', id);
                if (!error) return true;
            }
            const { error: errByCode } = await sup.from(tableNew).delete().eq('kode_sparepart', id);
            if (!errByCode) return true;
        } catch (e) { /* ignore and fallback */ }

        // fallback to old table
        try {
            let res = await sup.from(tableOld).delete().eq('item_code', id);
            if (res.error && res.error.code) {
                const { error } = await sup.from(tableOld).delete().eq('kode_item', id);
                if (error) throw new Error('itemsApi.deleteItem: ' + (error.message || JSON.stringify(error)));
                return true;
            }
            if (res.error) throw new Error('itemsApi.deleteItem: ' + (res.error.message || JSON.stringify(res.error)));
            return true;
        } catch (err) {
            throw new Error('itemsApi.deleteItem: ' + (err.message || JSON.stringify(err)));
        }
    }

    const exposed = { listItems, addItem, updateItem, deleteItem, resolveSparepartIdByCode };
    // expose globally for compatibility with legacy UI modules
    if (typeof window !== 'undefined') window.itemsApi = exposed;

    return exposed;
})();

