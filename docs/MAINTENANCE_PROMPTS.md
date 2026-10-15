# Maintenance Prompts

## Security review
Review proyek MYTHTOPPLACE untuk OWASP-style risks. Periksa auth, authorization, validation, rate limits, secrets, CORS, CSP, SQL/ORM usage, stock race conditions, webhook verification, logging, dependency vulnerabilities, dan exposure port. Berikan patch minimal yang kompatibel.

## Performance review
Audit query Prisma, indexes MySQL, bundle frontend, image sizes, API latency, N+1 queries, polling frequency, Docker resource usage, dan Nginx caching. Pertahankan fitur sambil menurunkan penggunaan CPU/RAM.

## Release review
Sebelum production release, buat checklist migration, backup, smoke test, rollback, environment changes, frontend build, API health, SSL, DNS, admin verification, dan transaction test.
