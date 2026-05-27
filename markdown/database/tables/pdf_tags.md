# Table: `pdf_tags`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712130018-pdf_tags.js`  
**Model:** `services/pdfForms/models/pdfTags.model.js`

## Purpose

Company-level tag definitions for organizing forms/files.

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | YES | — | → `companies.id` | Tenant |
| `tag_name` | STRING | YES | — | | Label |
| `user_id` | INTEGER | YES | — | → `users.id` | Creator |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
