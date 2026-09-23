# Jay Garrett — Electronic Press Kit Intake (MVP)

Local intake application for **TAIG Promotions** to collect EPK information from Jay Garrett.

This is an **intake form**, not the public EPK website.

## What it does

1. TAIG sends Jay one private URL  
2. Jay completes a 10-section mobile-friendly form  
3. Jay can **Save Progress** and return later via a resume link  
4. Jay reviews answers and submits  
5. Answers are stored locally as structured **submitted** data  
6. TAIG retrieves and reviews before any public use  

## Requirements

- Node.js **22.5+** (uses built-in `node:sqlite`)
- npm

## Setup

```bash
cd jays_web_form_for_epk_docs
copy .env.example .env
# Edit .env — set strong INTAKE_TOKEN and TAIG_REVIEW_TOKEN
npm install
npm start
```

## Local URLs

After `npm start` (default port 3000):

| Role | URL |
|------|-----|
| Jay intake | `http://localhost:3000/i/<INTAKE_TOKEN>` |
| TAIG review | `http://localhost:3000/taig/review?token=<TAIG_REVIEW_TOKEN>` |
| JSON list (protected) | `http://localhost:3000/api/taig/submissions?token=<TAIG_REVIEW_TOKEN>` |
| JSON export | `http://localhost:3000/api/taig/submissions/<id>/export.json?token=<TAIG_REVIEW_TOKEN>` |

Root `/` intentionally returns **Not found** (no public listing).

## Form version

`epk-intake-v1`

## Storage

Submissions are stored in local SQLite:

- Default path: `data/submissions.sqlite` (gitignored)
- Status is always stored as `submitted` (not validated)
- Does **not** publish a public EPK or alter any authoritative EPK document

## Environment

See `.env.example`:

- `PORT`
- `INTAKE_TOKEN` — unguessable path segment for Jay
- `TAIG_REVIEW_TOKEN` — required for review/export
- `DATABASE_PATH` — optional override

Never commit `.env` or the SQLite database.

## Local validation

With the server running in another terminal:

```bash
npm run validate
```

Or start + validate in one flow by running the validation script (it will use the configured tokens from `.env`).

## Project layout

```
server/          Express API + SQLite
public/          Mobile-first intake UI
scripts/         Local validation
docs/nebula/     Engineering documentation
data/            Local SQLite (gitignored)
```

## Branch

Development: `feature/aci-001`

## Replit

See `docs/nebula/passdowns/replit-deploy.md`.

Published Replit filesystems are not durable. Set `DATABASE_URL` (Replit SQL) for live persistence.

## Out of scope

- Public EPK site
- Replit deployment (separate ACI)
- CRM / booking / marketing automation
- Direct file uploads
