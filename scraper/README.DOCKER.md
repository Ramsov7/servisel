## Docker image for servisel-scraper

This Dockerfile builds a minimal container for the scraper service.

Build

```powershell
# from project root
cd scraper
docker build -t servisel-scraper:latest .
```

Run

```powershell
# Example (no Supabase):
docker run --rm servisel-scraper:latest "Samsung Galaxy A34"

# With Supabase envs (recommended for production):
docker run --rm -e SUPABASE_URL="https://..." -e SUPABASE_SERVICE_ROLE="<key>" servisel-scraper:latest "Samsung Galaxy A34"
```

Notes

- The image runs as a non-root user `scraperuser`.
- Provide Supabase credentials via env vars at runtime. Avoid baking secrets into the image.
- The container image uses the `start` command from `package.json` (node index.js).
