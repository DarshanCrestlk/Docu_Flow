# Table: `pdf_form_recipients`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712120420-pdf_form_recipients.js`  
**Model:** `services/pdfForms/models/pdfFormRecipients.model.js`

## Purpose

Signers and viewers on a form; holds signing token and delivery status.

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `form_id` | INTEGER | NO | — | → `pdf_forms.id` CASCADE | Parent form |
| `user_id` | INTEGER | YES | — | → `users.id` CASCADE | Internal user link |
| `status` | ENUM | YES | — | See below | Recipient progress |
| `r_priority` | INTEGER | YES | — | | Signing order (1 = first) |
| `name` | STRING | YES | — | | Display name |
| `email` | STRING | YES | — | | Delivery email |
| `token` | TEXT | YES | — | | Signer access token |
| `color` | STRING(50) | YES | — | | UI field color |
| `type` | ENUM | — | — | `inside_organization`, `outside_organization` | |
| `is_changed` | BOOLEAN | YES | `false` | | Form edited after send |
| `is_declined` | BOOLEAN | — | `false` | | Declined flag |
| `reason_for_declining` | TEXT | YES | — | | |
| `viewedAt` | DATE | YES | — | | First open timestamp |
| `role` | ENUM | YES | — | `viewer`, `signer` | |
| `message_id` | STRING | YES | — | | SES message id |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

### `status` values

`pending`, `mailed`, `viewed`, `completed`, `revoked`, `void`, `expired`, `bounced`

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
