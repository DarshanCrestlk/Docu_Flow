# Table: `pdf_form_tags`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712125835-pdf_form_tags.js` ⚠️  
**Model:** `services/pdfForms/models/pdfFormTags.model.js`

## Purpose

Join table: links `pdf_forms` to `pdf_tags`.

## Columns (model — source of truth)

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | YES | — | → `companies.id` | Tenant |
| `pdf_tag_id` | INTEGER | YES | — | → `pdf_tags.id` | Tag |
| `pdf_form_id` | INTEGER | YES | — | → `pdf_forms.id` CASCADE | Form |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | — | | |

## ⚠️ Migration mismatch

File `20250712125835-pdf_form_tags.js` incorrectly defines columns `tag_name`, `user_id` (copy of `pdf_tags`). **Fix migration** to match the model before production deploy.

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Documented from model; flagged bad migration |
