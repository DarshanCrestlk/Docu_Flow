# Table: `pdf_form_history`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712125139-pdf_form_history.js`  
**Model:** `services/pdfForms/models/pdfFormHistory.model.js`

## Purpose

Audit trail entries (who did what, when, from which IP/browser).

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `form_id` | INTEGER | NO | — | → `pdf_forms.id` CASCADE | |
| `performed_by` | INTEGER | YES | — | → `users.id` CASCADE | Internal user |
| `ip` | STRING | YES | — | | Client IP |
| `browser` | STRING | YES | — | | User-agent summary |
| `performer_name` | STRING | YES | — | | Name when external signer |
| `activity` | STRING | YES | — | | Human-readable line |
| `action` | ENUM | YES | — | See below | Normalized action |
| `performer_color` | STRING | YES | — | | Recipient color |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

### `action` values

`voided`, `drafted`, `completed`, `corrected`, `mailed`, `viewed`, `signed`, `declined`, `bounced`, `resent`, `expired`, `reminded`

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
