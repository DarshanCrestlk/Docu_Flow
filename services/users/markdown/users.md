# Users Service (`users`)

**Source:** `services/users/users.service.js`  
**Model:** `services/users/models/users.model.js`  
**Table:** `users`

## Role

Read-focused user/employee service for HRMS-style data: profiles, paginated lists, dropdowns, team/department lookups, and entity-scoped listings. Scoped by **`company_id`** from `ctx.meta.user` or params.

## Mixins

| Mixin | Purpose |
|-------|---------|
| `DBmixin("users")` | Sequelize adapter (MySQL RW/RO) |
| `modelRelationsmixin` | `this.settings.models.*` |
| `helperMixin` | RBAC (`rolesAndPermissions`), shared utilities |
| `CacheCleanerMixin(["users"])` | Cache invalidation |

## Actions

| Action | Cache | Description |
|--------|-------|-------------|
| `getById` | Yes | User by id with roles, permissions, internal/external employee, job title |
| `getAllUsers` | Yes | Paginated list: search, filters (status, gender, dept, team, user_type, entity), sort |
| `getAllUsersForDropDowns` | Yes | Active employees; optional sales/submissions permission scoping |
| `getAllUsersForEmployeeCode` | Yes | Codes by prefix / entity for code generation |
| `FetchAllUsersTeamBasedOnTeamId` | No | User id array for `team_id` |
| `FetchAllUsersDepartmentBasedOnDepartmentId` | No | User id array for `department_id` |
| `getUsersByEntity` | No | Paginated users with entity + leave rule includes |

### REST exposure

`getById` exposes REST: `GET /:id` (via moleculer-web when gateway aliases are configured).

## Methods (business logic)

All logic lives in service `methods` (not a separate file).

### `getById(ctx, model)`

Loads one user with nested `rolesPermission` → details → `allServices`, `rolesSubModules`, `roleDetailsTeamDepartment`, plus internal/external employee and job title. Returns `NOT_FOUND` or `SUCCESS` envelope from `constants/responses.constants`.

### `getAllUsers(ctx, model)`

- Pagination: `page`, `limit` (`PAGE_LIMIT` env default)
- Search: `full_name`, `employee_code`, `mobile_number`, `email`, department/team name (via `Sequelize.literal`)
- Filters: JSON `filter` for status, gender, department, team, user_type, entity
- Includes: department, teams, entities, rolesPermission, leave_rules, dropdown_job_title

### `getAllUsersForDropDowns(ctx, model)`

- Base: `employment_status: "active"`
- Optional `isPermission`: narrows ids via sales/submissions RBAC
- Lighter attribute set for UI pickers

### `getAllUsersForEmployeeCode(ctx, model)`

Filters by `employee_code` prefix or numeric regexp; optional `entity_id`.

### `getUsersByEntity(ctx)`

Entity + fiscal year filters on related `entities`; includes leave allocation details.

## Data model

**Canonical column list:** [markdown/database/tables/users.md](../../../markdown/database/tables/users.md)  
Update that file whenever this table changes.

## Security notes

- `getAllUsers` search uses interpolated values in `Sequelize.literal` — prefer parameterized queries.
- All list endpoints should enforce `company_id` from authenticated context in production gateways.

## File layout

```
users/
├── users.service.js
├── models/
│   └── users.model.js
└── markdown/
    └── users.md
```
