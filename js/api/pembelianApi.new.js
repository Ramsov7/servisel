/* pembelianApi.new.js — new-schema-only API for pembelian_sparepart + pembelian_detail
   Exposes: listPembelianNew, createPembelianNew
   New-shaped objects: header (id_pembelian, id_supplier, id_pengguna, tanggal_pembelian, total_bayar, catatan) and details
*/

const pembelianApiNew = (function () {
    const header = 'pembelian_sparepart';
    const detail = 'pembelian_detail';
    function getSafe() { return (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null); }

    async function listPembelianNew(limit = 200) {
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (pembelianApiNew.listPembelianNew)');
        try {
            const exists = (typeof tableExists === 'function') ? await tableExists(header, sup) : true;
            if (!exists) return [];
        } catch (e) { /* ignore */ }
        const { data, error } = await sup.from(header).select('*').order('tanggal_pembelian', { ascending: false }).limit(limit);
        if (error) throw error;
        return (data || []);
    }

    async function createPembelianNew({ id_supplier = null, id_pengguna = null, tanggal_pembelian = null, items = [], total_bayar = null, catatan = null }) {
        // items: [{ id_sparepart, jumlah, harga_satuan }]
        const sup = getSafe(); if (!sup) throw new Error('Supabase client belum siap (pembelianApiNew.createPembelianNew)');
        // create header
        const hdr = { id_supplier, id_pengguna, tanggal_pembelian: tanggal_pembelian || new Date().toISOString(), total_bayar: total_bayar || 0, catatan: catatan || null, created_at: new Date().toISOString() };
        try {
            const exists = (typeof tableExists === 'function') ? await tableExists(header, sup) : true;
            if (!exists) throw new Error('Tabel ' + header + ' tidak ditemukan di database');
        } catch (e) { /* ignore and let server return error */ }
        const { data: hdrData, error: hdrErr } = await sup.from(header).insert([hdr]).select();
        if (hdrErr) throw hdrErr;
        const createdHdr = hdrData && hdrData.length ? hdrData[0] : hdrData;
        const idPembelian = createdHdr.id_pembelian;

        // insert detail rows
        for (const it of (items || [])) {
            const d = { id_detail: gen_random_uuid ? gen_random_uuid() : null, id_pembelian: idPembelian, id_sparepart: it.id_sparepart, jumlah: it.jumlah || 1, harga_satuan: it.harga_satuan || 0, total_harga: (it.jumlah || 1) * (it.harga_satuan || 0) };
            await sup.from(detail).insert([d]);
            // update sparepart stok best-effort
            try {
                if (it.id_sparepart) {
                    const existsSp = (typeof tableExists === 'function') ? await tableExists('sparepart', sup) : true;
                    if (existsSp) {
                        const { data: sp } = await sup.from('sparepart').select('stok').eq('id_sparepart', it.id_sparepart).limit(1).single();
                        const curr = sp ? Number(sp.stok || 0) : 0;
                        await sup.from('sparepart').update({ stok: curr + (it.jumlah || 0) }).eq('id_sparepart', it.id_sparepart);
                    }
                }
            } catch (e) { /* ignore */ }
        }

        return { header: createdHdr };
    }

    const exposed = { listPembelianNew, createPembelianNew };
    if (typeof window !== 'undefined') window.pembelianApiNew = exposed;
    return exposed;
})();
