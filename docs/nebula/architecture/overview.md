# Architecture — Jay Garrett EPK Intake MVP

## Purpose

Collect structured EPK information from Jay Garrett for TAIG review.

## Components

1. **Static intake UI** (`public/`) — mobile-first multi-section form + review
2. **Express API** (`server/`) — bootstrap, submit, protected TAIG retrieval
3. **SQLite** (`data/submissions.sqlite`) — durable local submissions

## Access

- Jay: `/i/<INTAKE_TOKEN>`
- TAIG: `/taig/review?token=<TAIG_REVIEW_TOKEN>` and `/api/taig/*`

## Governance

Submission status is stored as `submitted` only. The application does not publish a public EPK or overwrite any authoritative EPK source document.
