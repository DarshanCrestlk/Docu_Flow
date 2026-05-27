# Table: `pdf_forms`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712120219-pdf_forms.js`  
**Model:** `services/pdfForms/models/pdfForms.model.js`

## Purpose

Main document / envelope record (form or template): PDF location, status, expiry, email content, audit outputs.

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `document_id` | STRING | YES | — | | External document identifier |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `size` | BIGINT | YES | — | | File size (bytes) |
| `title` | STRING | YES | — | | Display title |
| `is_priority_required` | BOOLEAN | — | `false` | | Sequential signing order |
| `file_id` | INTEGER | YES | — | → `pdf_form_files.id` CASCADE | Source file in library |
| `created_by` | INTEGER | YES | — | → `users.id` | Sender |
| `form_url` | TEXT | YES | — | | Current PDF URL (S3) |
| `form_original_url` | TEXT | YES | — | | Original upload URL |
| `key` | STRING | YES | — | | S3 key (working copy) |
| `form_original_key` | STRING | YES | — | | S3 key (original) |
| `expiration_date` | DATE | YES | — | | When form expires |
| `reminder_days` | INTEGER | YES | — | | Days between auto-reminders |
| `initiate` | BOOLEAN | YES | — | | Initiated vs draft flow flag |
| `void_reason` | TEXT | YES | — | | Reason if voided |
| `is_template` | BOOLEAN | YES | — | | Template vs live form |
| `attach_audit_log` | BOOLEAN | YES | `false` | | Attach audit PDF on complete |
| `audit_log_file_url` | TEXT | YES | — | | Audit PDF URL |
| `combined_file_url` | TEXT | YES | — | | Final merged PDF URL |
| `status` | ENUM | YES | `pending` | See below | Lifecycle status |
| `version` | FLOAT | YES | — | | Schema/version marker |
| `is_deleted` | BOOLEAN | YES | `false` | | Soft delete |
| `note` | TEXT | YES | — | | Internal note |
| `email_template` | TEXT | YES | — | | HTML email body |
| `email_subject` | TEXT | YES | — | | Email subject |
| `reason_for_deletion` | TEXT | YES | — | | Deletion reason |
| `form_token` | STRING | YES | — | | Optional form-level token |
| `self_signed` | BOOLEAN | YES | `false` | | Self-sign flow |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `mailedAt` | DATE | YES | CURRENT_TIMESTAMP | | First send time |

### `status` values

`pending`, `completed`, `voided`, `draft`, `expired`, `declined`, `deleted`

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
