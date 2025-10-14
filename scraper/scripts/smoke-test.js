// smoke-test.js - headless smoke test for index.html
// Usage:
// 1) npm install puppeteer --save-dev
// 2) node scripts/smoke-test.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const root = path.resolve(__dirname, '..');
    const url = process.env.SERVE_URL || 'http://127.0.0.1:8000/index.html';
    const out = [];

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // capture console messages
    page.on('console', msg => {
        const text = msg.text();
        out.push({ type: 'console', text });
        console.log('[console]', text);
    });

    // capture page errors
    page.on('pageerror', err => {
        out.push({ type: 'pageerror', text: String(err) });
        console.error('[pageerror]', err);
    });

    // capture request failures
    page.on('requestfailed', req => {
        out.push({ type: 'requestfailed', url: req.url(), method: req.method(), failure: req.failure() });
        console.error('[requestfailed]', req.method(), req.url(), req.failure() && req.failure().errorText);
    });

    // capture response status codes for scripts
    page.on('response', async res => {
        try {
            const req = res.request();
            if (req.resourceType() === 'script') {
                const status = res.status();
                out.push({ type: 'script', url: req.url(), status });
                console.log('[script]', status, req.url());
            }
        } catch (e) { }
    });

    console.log('Opening', url);
    try {
        const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('Main page response status:', resp && resp.status());
    } catch (e) {
        console.error('Failed to load page:', e.message || e);
        await browser.close();
        process.exit(2);
    }

    // wait a short time for async initializations
    await page.waitForTimeout(1500);

    // collect console logs already captured in `out`
    const errors = out.filter(i => i.type === 'pageerror' || i.type === 'requestfailed' || (i.type === 'script' && i.status >= 400));

    const reportPath = path.join(root, 'smoke-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ url, captured: out, errors }, null, 2));
    console.log('Wrote smoke report to', reportPath);

    if (errors.length) {
        console.error('Smoke test found errors (see smoke-report.json)');
        await browser.close();
        process.exit(1);
    }

    console.log('Smoke test passed: no console/page/script failures detected');
    await browser.close();
    process.exit(0);
})();
