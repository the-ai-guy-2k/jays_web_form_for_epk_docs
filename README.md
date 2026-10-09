# Jay Garrett — Public Web EPK V1 (+ preserved EPK intake)

On this branch (`feature/jay-web-epk-v1`) the root URL `/` is Jay Garrett's **public, read-only Web EPK**,
built from Jay-approved Current Truth (GVCA-ACICE — Jay Garrett Web EPK V1).

The original intake application is preserved at `/intake` (unlinked, `noindex`).

## Public Web EPK

- Content: `content/jay-garrett-epk.json` (structured artist data — edit here, not in templates)
- Renderer: `server/epk.js` (server-side HTML, no client framework)
- Assets: `public/epk/` (`epk.css`, `epk.js`, `img/`, public playback MP3s)
- Featured-track WAV masters: `media/masters/` (Git LFS; not statically served)
- Official WAV download: `GET /epk/download/:trackId` for the two approved featured masters (no password)
- Missing optional assets (artwork, photos) are omitted gracefully.

## Intake: what it does

1. Jay opens `/intake` directly to Section 1
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
# Edit .env — set a strong TAIG_REVIEW_TOKEN
npm install
npm start
```

## Local URLs

After `npm start` (default port 3000):

| Role | URL |
|------|-----|
| Public Web EPK | `http://localhost:3000/` |
| Manage EPK (coming soon, V2 placeholder) | `http://localhost:3000/manage` |
| Intake (preserved) | `http://localhost:3000/intake` |
| TAIG review | `http://localhost:3000/taig/review?token=<TAIG_REVIEW_TOKEN>` |
| JSON list (protected) | `http://localhost:3000/api/taig/submissions?token=<TAIG_REVIEW_TOKEN>` |
| JSON export | `http://localhost:3000/api/taig/submissions/<id>/export.json?token=<TAIG_REVIEW_TOKEN>` |

Saved drafts have unguessable resume links at `/intake?draft=<resumeToken>`. Older `/?draft=<resumeToken>` links redirect there.

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
content/         Structured public EPK data (Jay-approved)
server/          Express API + SQLite + EPK renderer
public/epk/      Public EPK styles, script, images
public/          Mobile-first intake UI
scripts/         Local validation
docs/nebula/     Engineering documentation
data/            Local SQLite (gitignored)
```

## Branch

- `feature/jay-web-epk-v1` — public Web EPK V1 (this branch)
- `feature/aci-001` — intake-only lineage (preserved, currently deployed)

## Replit

See `docs/nebula/passdowns/replit-deploy.md`.

Published Replit filesystems are not durable. Set `DATABASE_URL` (Replit SQL) for live persistence.

## Out of scope

- EPK content editor / CMS (V2)
- Replit deployment (separate ACI)
- CRM / booking / marketing automation
- Direct file uploads
