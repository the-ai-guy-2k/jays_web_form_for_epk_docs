# Data model — submissions

Table: `submissions`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| form_version | TEXT | e.g. `epk-intake-v1` |
| artist_name | TEXT | From Artist section |
| status | TEXT | Always `submitted` at insert |
| section_data | TEXT | JSON of all 10 sections |
| created_at | TEXT | ISO timestamp |
| submitted_at | TEXT | ISO timestamp |

Section JSON keys: `artist`, `bio`, `album`, `featured`, `photos`, `streaming`, `social`, `proof`, `live`, `contact`.
