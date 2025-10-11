# Servisel Scraper

Dual scraper for official and unofficial phone specifications. Built with Node.js (ESM). Stores merged results into Supabase `master_unit` table.

Environment variables:

- SUPABASE_URL - your Supabase project URL
- SUPABASE_KEY - anon or service key

Run locally:

1. cd scraper
2. npm install
3. SUPABASE_URL=... SUPABASE_KEY=... node index.js <Brand> <Model>

Run with Docker:

1. docker build -t servisel-scraper .
2. docker run --rm -e SUPABASE_URL=... -e SUPABASE_KEY=... servisel-scraper <Brand> <Model>

Notes:

- Official scrapers are modular under `official/`.
- Unofficial scrapers are under `unofficial/` (gsmarena implemented).
- merge logic in `helpers/mergeSpecs.js` follows priority rules: official overrides unofficial.

Environment file (.env)

You can store credentials in a `.env` file in the `scraper/` folder (do NOT commit it).
Create a `.env` with these keys (or use environment variables directly):

SUPABASE_URL=https://your.supabase.co
SUPABASE_KEY=your_anon_or_service_key

Recommended workflow

- For local testing use anon key (less privileges). For server-side inserts use a service role key stored securely and not committed to source control.
- After validating, rotate the keys in Supabase Dashboard (Settings → API) to avoid leaving credentials published.

Quick verify (list recent master_unit rows):

Create env vars and run the helper script:

Windows PowerShell example:

```powershell
$env:SUPABASE_URL='https://zfppkxvlpuisxmhdtmeu.supabase.co'; $env:SUPABASE_KEY='YOUR_KEY'; node listMasterUnits.js
```

Security notes

- The project previously contained an anon key in `js/api/supabaseClient.js`; rotate it if you rely on it.
- Keep secrets out of version control. Use `.env` + `.gitignore` or a secret manager for production.

## Sanitizer and server uploader

To avoid schema errors when uploading merged payloads, the uploaders sanitize payloads and only send these columns to the `master_unit` table:

-- `nama_brand`, `nama_model`, `variant`, `kode_model`,
-- `official_specs`, `unofficial_specs`,
-- `status`, `created_at`, `updated_at`

If your scraped payload includes legacy keys like `detailSpec` or `detail_spec`, the uploaders will map them into `unofficial_specs` automatically.

Use the server-side uploader when you need to write to the DB (it requires a service role key):

PowerShell example:

```powershell
$env:SUPABASE_URL='https://your.supabase.co';
$env:SUPABASE_SERVICE_KEY='YOUR_SERVICE_ROLE_KEY';
node server-uploader.mjs
```

If you prefer a dry-run (no writes), add `--dry-run`:

```powershell
node server-uploader.mjs --dry-run
```

Client-side uploader `upload-saved-payloads.mjs` has the same sanitizer and supports `--dry-run` as well. Use an anon key for testing reads and a service role key only on trusted servers.
