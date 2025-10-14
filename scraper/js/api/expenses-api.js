/* expensesApi.js — wrapper for expenses operations */

const expensesApi = (function () {
    const table = 'expenses';
    const fallbackHeader = 'pembelian_sparepart';

    async function listExpenses(limit = 100) {
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client not initialized');
        try {
            if (typeof window.tableExists === 'function') {
                const ok = await window.tableExists(table, sup);
                if (!ok) throw new Error('Table not found');
            }
            const { data, error } = await sup.from(table).select('*').order('tanggal', { ascending: false }).limit(limit);
            if (error) throw error;
            return data || [];
        } catch (e) {
            // If expenses table doesn't exist, try to return recent pembelian_sparepart as a proxy
            try {
                if (typeof window.tableExists === 'function') {
                    const ok2 = await window.tableExists(fallbackHeader, sup);
                    if (!ok2) return [];
                }
                const { data } = await sup.from(fallbackHeader).select('id_pembelian,tanggal_pembelian,catatan,total_bayar').order('tanggal_pembelian', { ascending: false }).limit(limit);
                return (data || []).map(d => ({ tanggal: d.tanggal_pembelian, kategori: 'Pembelian/Expense', jumlah: d.total_bayar, catatan: d.catatan, kode_transaksi: d.id_pembelian }));
            } catch (err) {
                throw new Error('expensesApi.listExpenses: ' + (err.message || JSON.stringify(err)));
            }
        }
    }

    async function addExpense(payload) {
        // payload: { tanggal, kategori, jumlah, catatan?, kode_transaksi? }
        const sup = (typeof getSupabase === 'function') ? getSupabase() : (window.supabase || null);
        if (!sup) throw new Error('Supabase client not initialized');

        // Try inserting into expenses table first
        try {
            const { data, error } = await sup.from(table).insert([payload]).select();
            if (!error) return data?.[0] ?? null;
        } catch (e) {
            // if it fails (table missing), we'll fallback
        }

        // Fallback: create a pembelian_sparepart record describing the expense (non-atomic but keeps data)
        try {
            const header = { id_supplier: null, id_pengguna: null, tanggal_pembelian: payload.tanggal || new Date().toISOString(), total_bayar: payload.jumlah || 0, catatan: `[expense] ${payload.kategori || ''} ${payload.catatan || ''}`, created_at: new Date().toISOString() };
            const { data, error } = await sup.from(fallbackHeader).insert([header]).select();
            if (error) throw error;
            const created = data && data.length ? data[0] : data;
            return { tanggal: created.tanggal_pembelian, kategori: payload.kategori, jumlah: payload.jumlah, catatan: payload.catatan, kode_transaksi: created.id_pembelian };
        } catch (err) {
            throw new Error('expensesApi.addExpense: ' + (err.message || JSON.stringify(err)));
        }
    }

    return { listExpenses, addExpense };
})();
