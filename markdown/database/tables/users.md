# Table: `users`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712114536-create_users.js`  
**Model:** `services/users/models/users.model.js`

## Purpose

User accounts for DocuFlow, HRMS, and ATS. `company_id` scopes tenant data; `user_from` records provenance.

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | YES | — | → `companies.id` | Tenant / organization |
| `full_name` | STRING | NO | — | | Display name |
| `password` | STRING | YES | — | | Hashed password; null for SSO-only |
| `email` | STRING | NO | — | | Login identifier |
| `mobile_number` | STRING | YES | — | | |
| `profile_bg_color` | STRING | YES | — | | Avatar background |
| `type` | ENUM | NO | — | `super_admin`, `admin`, `user` | Role within tenant |
| `profile_pic` | STRING | YES | — | | Avatar URL |
| `timezone` | STRING | YES | — | | IANA or app timezone |
| `user_from` | ENUM | YES | — | `HRMS`, `ATS`, `DOCU_FLOW` | Where account originated |
| `status` | ENUM | YES | — | `active`, `inactive` | Account enabled state |
| `createdAt` | DATE | NO | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | — | | |

## Notes

- DocuFlow signup: create `companies` row first, then user with `user_from = DOCU_FLOW`, `type = admin` for first user in org.
- `super_admin` may use `company_id` NULL only if you implement platform-level access separately.

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Slimmed schema for standalone; removed HRMS fields (`role`, `team_id`, `leave_id`, etc.) |
