# Table: `pdf_form_signature_initials`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712130332-pdf_form_signature_initials.js`  
**Model:** `services/pdfForms/models/pdfFormSignatureInitials.model.js`

## Purpose

Saved signature and initials assets per user/email (reused across signings).

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `sign_uuid` | STRING | YES | unique | | Stable signature profile id |
| `company_id` | INTEGER | YES | — | → `companies.id` CASCADE | Tenant |
| `user_id` | INTEGER | YES | — | → `users.id` CASCADE | |
| `initials_url` | STRING(255) | YES | — | | S3 URL |
| `signature_url` | STRING(255) | YES | — | | S3 URL |
| `signature_key` | STRING(255) | YES | — | | S3 key |
| `initials_key` | STRING(255) | YES | — | | S3 key |
| `email` | STRING(255) | YES | — | | For external signers |
| `createdAt` | DATE | — | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
