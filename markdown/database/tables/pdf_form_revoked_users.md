# Table: `pdf_form_revoked_users`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712125548-pdf_form_revoked_users.js`  
**Model:** `services/pdfForms/models/pdfFormRevokedUsers.model.js`

## Purpose

Snapshot of recipients removed/revoked from a form (token invalidated).

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `form_id` | INTEGER | NO | — | → `pdf_forms.id` CASCADE | |
| `name` | STRING | YES | — | | |
| `email` | STRING | YES | — | | |
| `token` | TEXT | YES | — | | Previous token |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
