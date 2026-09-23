# TAIG retrieval (local)

1. Start the app: `npm start`
2. Open review UI:

`http://localhost:3000/taig/review?token=<TAIG_REVIEW_TOKEN>`

3. Select a submission ID to view section JSON.
4. Download export:

`/api/taig/submissions/<id>/export.json?token=<TAIG_REVIEW_TOKEN>`

Contact fields are private by default in product intent; the review UI is token-protected and must not be shared publicly.
