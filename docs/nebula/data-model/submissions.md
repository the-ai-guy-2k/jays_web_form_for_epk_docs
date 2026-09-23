# Data model — submissions / drafts

Table: `submissions`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| resume_token | TEXT UNIQUE | Unguessable resume key for drafts (nullable for legacy) |
| form_version | TEXT | e.g. `epk-intake-v1` |
| artist_name | TEXT | From Artist section |
| status | TEXT | `draft` or `submitted` |
| section_data | TEXT | JSON of all 10 sections |
| current_step | INTEGER | Last section index for resume UX |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp (draft saves bump this) |
| submitted_at | TEXT | ISO timestamp when status becomes `submitted`; null while draft |

Section JSON keys: `artist`, `bio`, `album`, `featured`, `photos`, `streaming`, `social`, `proof`, `live`, `contact`.

Resume URL pattern: `/i/<INTAKE_TOKEN>?draft=<resume_token>`
