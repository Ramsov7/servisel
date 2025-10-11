import axios from 'axios';
import { createRequire } from 'module';
import { spawn } from 'child_process';

const LOCAL_PORT = 4000;
const LOCAL_BASE = `http://127.0.0.1:${LOCAL_PORT}`;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

export default async function scrapeMobileSpecs(brand, model) {
    const slugGuess = (brand + ' ' + model)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    // Try calling a local running server first
    try {
        console.debug('[mobile-specs] trying direct slug GET', `${LOCAL_BASE}/${slugGuess}`);
        const resp = await axios.get(`${LOCAL_BASE}/${slugGuess}`);
        if (resp && resp.data) {
            const details = resp.data;
            console.debug('[mobile-specs] direct slug returned data for', slugGuess);
            const detailSpec = [];
            const specs = details.specifications || {};
            for (const [category, specObj] of Object.entries(specs)) {
                const specifications = Object.entries(specObj || {}).map(([k, v]) => ({ name: k, value: v }));
                detailSpec.push({ category, specifications });
            }
            return {
                name: `${details.brand || brand} ${details.model || model}`.trim(),
                img: details.imageUrl || details.image || '',
                detailSpec,
                quickSpec: []
            };
        } else {
            console.debug('[mobile-specs] direct slug returned no data for', slugGuess);
        }
    } catch (e) {
        console.debug('[mobile-specs] direct slug GET failed (server may not be running or 404) -', e && e.message);
        // not running — we'll try to start the compiled server in-process
    }

    // Try to start the compiled server by requiring or spawning it
    const require = createRequire(import.meta.url);
    const serverPathCandidates = [
        '../../mobile-specs-api-main/dist/server.js',
        '../../mobile-specs-api-main/dist/server',
    ];

    let started = false;
    for (const p of serverPathCandidates) {
        try {
            // If file exists, prefer spawning a detached node process to avoid blocking
            const abs = require.resolve(p);
            // spawn node <abs>
            const child = spawn(process.execPath, [abs], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
            started = true;
            break;
        } catch (e) {
            // ignore
        }
    }

    if (!started) {
        // as a last resort, try to require the server which will start it in-process
        try {
            require('../../mobile-specs-api-main/dist/server.js');
            started = true;
        } catch (e) {
            // can't start local server
        }
    }

    if (started) {
        // wait briefly for server to start
        await sleep(700);
        try {
            let details = null;
            try {
                const resp = await axios.get(`${LOCAL_BASE}/${slugGuess}`);
                details = resp && resp.data ? resp.data : null;
                if (details) console.debug('[mobile-specs] direct slug after start returned data for', slugGuess);
            } catch (e) {
                console.debug('[mobile-specs] direct slug after start failed (404 or network) -', e && e.message);
            }
            // if direct slug didn't return, try search endpoint
            if (!details) {
                try {
                    const q = encodeURIComponent(`${brand} ${model}`);
                    console.debug('[mobile-specs] calling search endpoint', `${LOCAL_BASE}/search?query=${q}`);
                    const s = await axios.get(`${LOCAL_BASE}/search?query=${q}`);
                    // server may return { value: [...], Count: n } or an array directly
                    const list = s && s.data ? (Array.isArray(s.data) ? s.data : (s.data.value || [])) : [];
                    console.debug('[mobile-specs] search returned', Array.isArray(list) ? list.length : typeof list, 'items');
                    if (Array.isArray(list) && list.length > 0) {
                        // try up to first 3 candidates until we find details
                        for (const candidate of list.slice(0, 3)) {
                            try {
                                const slug = candidate && (candidate.slug || (candidate.detail_url && candidate.detail_url.replace(/^\//, '')));
                                console.debug('[mobile-specs] trying candidate slug', slug);
                                if (!slug) continue;
                                const d = await axios.get(`${LOCAL_BASE}/${slug.replace(/^\//, '')}`);
                                if (d && d.data) {
                                    details = d.data;
                                    console.debug('[mobile-specs] fetched details for', slug);
                                    break;
                                }
                            } catch (ee) {
                                console.debug('[mobile-specs] candidate fetch failed', ee && ee.message);
                                // try next candidate
                            }
                        }
                    }
                } catch (e) {
                    console.debug('[mobile-specs] search call failed', e && e.message);
                    // ignore search failures
                }
            }
            if (details) {
                const detailSpec = [];
                const specs = details.specifications || {};
                for (const [category, specObj] of Object.entries(specs)) {
                    const specifications = Object.entries(specObj || {}).map(([k, v]) => ({ name: k, value: v }));
                    detailSpec.push({ category, specifications });
                }
                return {
                    name: `${details.brand || brand} ${details.model || model}`.trim(),
                    img: details.imageUrl || details.image || '',
                    detailSpec,
                    quickSpec: []
                };
            }
        } catch (e) {
            // fall through
        }
    }

    return {};
}
