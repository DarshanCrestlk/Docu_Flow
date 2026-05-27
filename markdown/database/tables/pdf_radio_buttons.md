# Table: `pdf_radio_buttons`

**Last updated:** 2025-05-27  
**Migration:** `migrations/20250712124854-pdf_radio_buttons.js`  
**Model:** `services/pdfForms/models/pdfFormRadioButtons.model.js`

## Purpose

Radio button placements/options linked to a radio field.

> Sequelize model name: `pdf_form_radio_buttons` — table name in DB is `pdf_radio_buttons`.

## Columns

| Column | Type | Null | Default | FK / Enum | Description |
|--------|------|------|---------|-----------|-------------|
| `id` | INTEGER | NO | auto | PK | |
| `company_id` | INTEGER | NO | — | → `companies.id` | Tenant |
| `field_id` | INTEGER | YES | — | → `pdf_form_fields.id` CASCADE | |
| `uuid_field_id` | STRING | YES | unique | | Option instance id |
| `field_label` | STRING | YES | — | | |
| `order` | INTEGER | YES | — | | Display order |
| `x_coordinate` | FLOAT | YES | — | | |
| `y_coordinate` | FLOAT | YES | — | | |
| `scale_x` | FLOAT | YES | — | | |
| `scale_y` | FLOAT | YES | — | | |
| `zoom_x` | FLOAT | YES | — | | |
| `zoom_y` | FLOAT | YES | — | | |
| `height` | FLOAT | YES | — | | |
| `width` | FLOAT | YES | — | | |
| `fill` | STRING | YES | — | | |
| `createdAt` | DATE | YES | CURRENT_TIMESTAMP | | |
| `updatedAt` | DATE | YES | CURRENT_TIMESTAMP | | |

## Change log

| Date | Change |
|------|--------|
| 2025-05-27 | Initial doc from migration |
