/* pembelianApi.js — wrapper for pembelian (purchases) operations */

const pembelianApi = (function () {
    // Possible table name candidates (different projects use different names)
    const headerCandidates = ['pembelian_sparepart', 'pembelian_header', 'pembelian'];
    const detailCandidates = ['pembelian_detail', 'pembelian_line', 'pembelian_detail_sparepart', 'pembelian'];

    // Helper: find the first table that exists by attempting a lightweight probe.
    async function resolveTable(sup, candidates) {
        for (const t of candidates) {
            try {
                // lightweight probe: check table existence first to avoid unauthenticated REST calls
                if (typeof window.tableExists === 'function') {
                    const ok = await window.tableExists(t, sup);
                    if (!ok) continue;
                }
                const { data, error } = await sup.from(t).select('*').limit(1);
                if (!error) return t;
            } catch (e) {
                // ignore and try next candidate
            }
        }
        return null;
    }

    async function listPembelian(limit = 100) {
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client not initialized');

        try {
            // Try reading new header table and join details via rpc or separate queries
            const { data, error } = await sup.from(tableHeader).select('*').order('tanggal_pembelian', { ascending: false }).limit(limit);
            if (error) throw error;
            // Map to legacy shape for UI: kode_pembelian, tanggal, kode_item (use first detail), qty, harga_beli, total, sumber, catatan
            const out = [];
            for (const h of (data || [])) {
                // fetch details for header (small list)
                const { data: details } = await sup.from(tableDetail).select('*').eq('id_pembelian', h.id_pembelian).limit(100);
                if (!details || details.length === 0) {
                    out.push({ kode_pembelian: h.id_pembelian, tanggal: h.tanggal_pembelian, kode_item: null, qty: 0, harga_beli: 0, total: h.total_bayar || 0, sumber: h.catatan || null, catatan: h.catatan || null, _raw: { header: h } });
                } else {
                    for (const d of details) {
                        out.push({ kode_pembelian: h.id_pembelian, tanggal: h.tanggal_pembelian, kode_item: d.id_sparepart || null, qty: d.jumlah, harga_beli: d.harga_satuan, total: d.total_harga, sumber: h.catatan || null, catatan: h.catatan || null, _raw: { header: h, detail: d } });
                    }
                }
            }
            return out;
        } catch (e) {
            // fallback to legacy table
            try {
                const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
                const { data, error } = await sup.from(legacyTable).select('*').order('tanggal', { ascending: false }).limit(limit);
                if (error) throw error;
                return data || [];
            } catch (err) {
                throw new Error('pembelianApi.listPembelian: ' + (err.message || JSON.stringify(err)));
            }
        }
    }

    async function addPembelian(payload) {
        // payload: { kode_pembelian, tanggal, kode_item|item_code, qty, harga_beli, sumber?, catatan? }
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client not initialized');

        // Normalize incoming data
        const kodeItem = payload.kode_item || payload.item_code || null;
        const qty = Number(payload.qty || 0);
        const harga = Number(payload.harga_beli || payload.harga_satuan || 0);

        // Try to resolve sparepart id using itemsApi helper if available
        let idSparepart = null;
        try {
            if (window.itemsApi && typeof window.itemsApi.resolveSparepartIdByCode === 'function') {
                idSparepart = await window.itemsApi.resolveSparepartIdByCode(kodeItem);
            }
        } catch (e) { /* ignore */ }

        // Insert header into pembelian_sparepart
        try {
            const hdrTable = await resolveTable(sup, headerCandidates);
            const detTable = await resolveTable(sup, detailCandidates);

            if (!hdrTable) {
                throw new Error('pembelianApi.addPembelian: no suitable header table found (checked: ' + headerCandidates.join(', ') + ')');
            }

            // If the project uses a single legacy `pembelian` table, write there and return
            if (hdrTable === 'pembelian' && (!detTable || detTable === 'pembelian')) {
                const writePayload = Object.assign({}, payload);
                if (kodeItem && !writePayload.kode_item) writePayload.kode_item = kodeItem;
                const { data, error } = await sup.from('pembelian').insert([writePayload]).select();
                if (error) throw error;
                return data?.[0] ?? null;
            }

            // Otherwise insert into header table and then into detail table if available
            const header = { id_supplier: null, id_pengguna: null, tanggal_pembelian: payload.tanggal || new Date().toISOString(), total_bayar: (qty * harga) || payload.total_bayar || 0, catatan: payload.catatan || payload.sumber || null, created_at: new Date().toISOString() };
            const { data: hdrData, error: hdrErr } = await sup.from(hdrTable).insert([header]).select();
            if (hdrErr) throw hdrErr;
            const createdHeader = hdrData && hdrData.length ? hdrData[0] : (hdrData || null);
            // pick an id field name from the created header (common names: id_pembelian, id)
            const idField = createdHeader && (createdHeader.id_pembelian ? 'id_pembelian' : (createdHeader.id || Object.keys(createdHeader)[0]));
            const idPembelian = createdHeader ? createdHeader[idField] : null;

            if (detTable && detTable !== hdrTable) {
                // Insert detail row(s)
                const detailBody = {
                    // common foreign key name: id_pembelian or id_header
                    id_pembelian: idPembelian,
                    id_sparepart: idSparepart || null,
                    jumlah: qty || 1,
                    harga_satuan: harga || 0
                    // omit total_harga: some schemas compute this via trigger/default and
                    // inserting a non-DEFAULT value causes an error. Let the DB compute it.
                };
                const { data: dData, error: dErr } = await sup.from(detTable).insert([detailBody]).select();
                if (dErr) throw dErr;
            }

            // Best-effort: update sparepart stock if id available
            try {
                if (idSparepart) {
                    // read current stock
                    const { data: spData } = await sup.from('sparepart').select('stok').eq('id_sparepart', idSparepart).limit(1).single();
                    const curr = spData ? Number(spData.stok || 0) : 0;
                    const newStock = curr + qty;
                    await sup.from('sparepart').update({ stok: newStock }).eq('id_sparepart', idSparepart);
                }
            } catch (e) { /* ignore stock update errors */ }

            // Return a legacy-shaped response containing header + detail summary
            return { kode_pembelian: idPembelian, tanggal: createdHeader ? (createdHeader.tanggal_pembelian || createdHeader.tanggal || null) : null, kode_item: idSparepart || kodeItem, qty, harga_beli: harga, total: (qty * harga), sumber: payload.sumber || null, catatan: payload.catatan || null };
        } catch (err) {
            throw new Error('pembelianApi.addPembelian: ' + (err.message || JSON.stringify(err)));
        }
    }

    const _pembelianApi = { listPembelian, addPembelian };
    // expose for global use by UI modules
    if (typeof window !== 'undefined') window.pembelianApi = _pembelianApi;

    return _pembelianApi;
})();
