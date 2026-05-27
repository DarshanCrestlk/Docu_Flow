# Table: `pdf_form_fields`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712120917-pdf_form_fields.js`  
**Model:** `services/pdfForms/models/pdfFormFields.model.js`

## Purpose

Placed fields on a PDF (position, type, value, completion state).

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `form_id` | INTEGER | NO | — | → `pdf_forms.id` CASCADE | |
| `form_recipient_id` | INTEGER | YES | — | → `pdf_form_recipients.id` CASCADE | Assigned recipient |
| `uuid_field_id` | STRING | YES | unique | | Client-side field id |
| `is_required` | BOOLEAN | — | `false` | | |
| `field_label` | STRING | YES | — | | |
| `type` | ENUM | YES | — | See below | Field widget type |
| `tooltip` | STRING | YES | — | | |
| `default_value` | TEXT | YES | — | | |
| `status` | ENUM | YES | `pending` | `pending`, `completed` | Fill state |
| `field_order` | INTEGER | YES | — | | |
| `x_coordinate` | FLOAT | YES | — | | |
| `y_coordinate` | FLOAT | YES | — | | |
| `width` | FLOAT | YES | — | | |
| `height` | FLOAT | YES | — | | |
| `zoom_x` | FLOAT | YES | — | | |
| `zoom_y` | FLOAT | YES | — | | |
| `scale_x` | FLOAT | YES | — | | |
| `scale_y` | FLOAT | YES | — | | |
| `fill` | STRING | YES | — | | Color/fill |
| `pageIndex` | INTEGER | YES | — | | Zero-based page |
| `field_Data` | STRING | YES | — | | Submitted value |
| `selected_option` | INTEGER | YES | — | | Dropdown/radio selection |
| `font_family` | STRING | YES | `Times-Roman` | | |
| `character_limit` | INTEGER | YES | — | | |
| `date_format` | ENUM | YES | `MM-DD-YYYY` | `MM-DD-YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD` | |
| `font_size` | INTEGER | YES | — | | |
| `rows` | INTEGER | YES | — | | |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

### `type` values

`checkbox`, `text`, `signature`, `digital signature`, `date`, `dropdown`, `radio`, `full_name`, `signed_date`, `email_id`, `company`, `title`, `initial`, `number`

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
