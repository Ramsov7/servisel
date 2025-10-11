import fs from 'fs/promises';
import path from 'path';

async function main() {
    const outDir = path.resolve('output');
    let files = [];
    try { files = await fs.readdir(outDir); } catch (e) { console.error('No output dir', e.message); process.exit(1); }
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    for (const f of jsonFiles) {
        const p = path.join(outDir, f);
        try {
            const raw = await fs.readFile(p, 'utf8');
            const parsed = JSON.parse(raw);
            let payload = parsed.payload || null;
            if (!payload) {
                // try to infer from known shapes
                if (parsed.payload) payload = parsed.payload;
                else if (parsed.merged && parsed.merged.name) {
                    payload = { nama_brand: parsed.merged.name.split(' ')[0] || parsed.merged.name, nama_model: parsed.merged.name };
                } else if (parsed.name) {
                    payload = { nama_brand: parsed.name.split(' ')[0] || parsed.name, nama_model: parsed.name };
                } else if (parsed.unofficial_specs && parsed.unofficial_specs.name) {
                    payload = { nama_brand: (parsed.unofficial_specs.name.split(' ')[0] || parsed.unofficial_specs.name), nama_model: parsed.unofficial_specs.name };
                }
            }
            // If still null, skip
            if (!payload) {
                console.log('Skipping', f, '- cannot infer payload');
                continue;
            }
            // Ensure nama_brand and nama_model fields exist
            payload.nama_brand = payload.nama_brand || (payload.name ? payload.name.split(' ')[0] : 'UNKNOWN');
            payload.nama_model = payload.nama_model || payload.name || payload.nama_brand;

            const outName = f.replace(/\.json$/, '') + '.upload.json';
            const outPath = path.join(outDir, outName);
            await fs.writeFile(outPath, JSON.stringify({ payload }, null, 2), 'utf8');
            console.log('Wrote', outName);
        } catch (e) {
            console.error('Failed', f, e.message);
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
