# Table: `pdf_fields_options`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712124600-pdf_fields_options.js`  
**Model:** `services/pdfForms/models/pdfFieldsOptions.model.js`

## Purpose

Options for dropdown-type `pdf_form_fields`.

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `field_id` | INTEGER | NO | — | → `pdf_form_fields.id` CASCADE | Parent field |
| `label` | STRING | NO | — | | Option text |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
