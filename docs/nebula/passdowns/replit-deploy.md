# Replit deployment — Operator checklist

## Source

- Repo: `the-ai-guy-2k/jays_web_form_for_epk_docs`
- Branch: `feature/aci-001`

## Why SQLite alone is not enough on Replit Publish

Published Replit app filesystems reset on republish/restart.  
For live PASS, enable **Replit SQL Database** and set `DATABASE_URL` so the app uses Postgres.

Development database storage is included free per Replit docs.  
**Production** database compute/storage may consume plan credits — Operator must approve before enabling production DB billing.

## Import steps

1. Open https://replit.com/import → GitHub
2. Import `the-ai-guy-2k/jays_web_form_for_epk_docs` branch `feature/aci-001`
3. Run `npm install`
4. Tools → Secrets — set:
   - `INTAKE_TOKEN` (production value from Operator CAE return)
   - `TAIG_REVIEW_TOKEN` (production value from Operator CAE return)
   - `DATABASE_URL` (from Replit Database tool — Development or approved Production)
5. Tools → Database — confirm database exists / create tables via app start
6. Publish (Autoscale) — server app, not Static
7. Also add the same Secrets in the **Publishing** secrets panel (editor secrets do not auto-carry)

## Live URLs (after publish)

- Intake: `https://<published-host>/i/<INTAKE_TOKEN>`
- TAIG review: `https://<published-host>/taig/review?token=<TAIG_REVIEW_TOKEN>`
- Health: `https://<published-host>/health`

## Persistence proof

1. Submit a test intake
2. Confirm visible in TAIG review
3. Restart / republish
4. Confirm same submission ID still retrievable

Do not send intake URL to Jay until Operator acceptance.
