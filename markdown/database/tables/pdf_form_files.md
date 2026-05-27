# Table: `pdf_form_files`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712120218-pdf_files.js`  
**Model:** `services/pdfForms/models/pdfFormFiles.model.js`

## Purpose

Company PDF file library (uploaded documents before sending as forms).

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `file_name` | STRING | YES | — | | Original filename |
| `created_by` | INTEGER | YES | — | → `users.id` CASCADE | Uploader |
| `file_url` | TEXT | YES | — | | S3 URL |
| `size` | BIGINT | YES | — | | Bytes |
| `key` | STRING | YES | — | | S3 object key |
| `is_deleted` | BOOLEAN | YES | `false` | | Soft delete |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
