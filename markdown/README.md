# DocuFlow — External documentation

Central documentation lives here (outside `services/`). Service-specific guides remain under each service’s `markdown/` folder when needed.

## Database schema (`database/`)

**Single source of truth for table columns** when reviewing or changing the data model.

| When you… | Also update… |
|-----------|----------------|
| Add/change/remove a column in a **migration** | Matching file in `markdown/database/tables/` |
| Change a **Sequelize model** (`*.model.js`) | Same table markdown (model and migration must agree) |
| Add a **new table** | New `tables/<table_name>.md` + row in `database/INDEX.md` |

### Workflow

1. Edit migration under `migrations/`.
2. Edit model under `services/**/models/`.
3. Update `markdown/database/tables/<table_name>.md` (field table + “Last updated” date).
4. If FKs or enums changed, skim `database/INDEX.md` and ER diagram.

### File layout

```
markdown/
├── README.md                 ← you are here
└── database/
    ├── INDEX.md              ← all tables + relationships
    └── tables/
        ├── users.md
        ├── pdf_forms.md
        └── …
```

**Do not** duplicate full column lists in service markdown; link here instead.

Example in service docs:

```markdown
See [users table](../../markdown/database/tables/users.md).
```
