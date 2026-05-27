# Table: `pdf_form_reminder_logs`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712125349-pdf_form_reminder_logs.js`  
**Model:** `services/pdfForms/models/pdfFormReminderLogs.model.js`

## Purpose

Log each cron/manual reminder run per form.

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `form_id` | INTEGER | YES | — | → `pdf_forms.id` CASCADE | |
| `execution_date` | DATE | YES | — | | When reminder ran |
| `status` | ENUM | YES | — | `success`, `failed` | |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
