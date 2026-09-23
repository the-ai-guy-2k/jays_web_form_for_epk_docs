# Local validation evidence — 2026-09-23

Command: `npm run validate`

Result: **20 PASS / 0 FAIL**

Covered:

- Intake loads with valid token; bad token 404
- Known data bootstrap
- Client/server validation (email, URL, required confirmations)
- Submit persists with UUID + timestamp + confirmation message
- Optional fields skipped successfully
- TAIG retrieval + data match
- Unauthorized enumeration blocked
- Root does not expose intake
- No secrets in intake HTML
- 10 sections + field types present
- Navigation/retain implementation present
- Mobile-first CSS present
- Storage failure handling present

Runtime method: ephemeral Express listeners against isolated SQLite file `data/validation-submissions.sqlite`.
