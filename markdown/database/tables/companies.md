# Table: `companies`

**Last updated:** 2025-05-27  
**Migration:** `20250712114000-create_companies.js`  
**Model:** `services/companies/models/companies.model.js`

## Purpose

Tenant / organization workspace. Referenced by `users.company_id` and all PDF tables.

## Columns

| Column | Type | Null | Description |
|--------|------|------|-------------|
| `id` | INTEGER | NO | PK |
| `name` | STRING | NO | Used in S3 path prefix |
| `phone_no` | STRING | NO | Company phone |
| `from_email_name` | STRING | NO | Display name for outbound emails |
| `from_email` | STRING | NO | From address for outbound emails |
| `industry` | STRING | NO | Industry |
| `address` | STRING | NO | Address |
| `country` | STRING | NO | Country |
| `logo` | STRING | YES | Logo URL/path |
| `theme` | STRING | YES | Theme name |
| `themejson` | JSON | YES | Theme config |
| `company_domain` | STRING | YES | Optional domain |
| `document_storage` | BIGINT | YES | Storage quota/usage (bytes) |
| `createdAt` | DATE | NO | |
| `updatedAt` | DATE | YES | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Placeholder for standalone DocuFlow |
