# API Service (`api`)

**Source:** `services/api.service.js`  
**Moleculer name:** `api`  
**Type:** API Gateway (moleculer-web + Socket.IO)

## Role

The API service is the **HTTP and WebSocket entry point** for clients. It routes requests to other Moleculer services via aliases (`routes/routes.js`) and `rest` blocks on domain service actions. It does not own business or database logic.

## Mixins

| Mixin | Purpose |
|-------|---------|
| `ApiGateway` | moleculer-web HTTP server |
| `helperMixin` | Shared helpers (JWT, email, etc.) |

## Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| `port` | `process.env.PORT \|\| 3000` | |
| `ip` | `0.0.0.0` | |
| Global middleware | `compression(1)` | |
| Body parsers | JSON / urlencoded, 10MB | |
| `mappingPolicy` | `restrict` | Only declared routes |
| `mergeParams` | `true` | |
| `authentication` | `false` | JWT `authenticate` is commented out |
| `authorization` | `true` | Custom `authorize` method |

## Routes

### `GET/POST … /api`

- Whitelist: `**`
- Aliases from `routes/routes.js` (node introspection: `~node/actions`, `~node/services`, etc.)
- Domain REST paths come from `rest: { method, path }` on actions (e.g. `users.getById`)

### `/assets`

Static files from `public/` (ETag, `maxAge: 1d`).

## Request hooks

### `onBeforeCall`

- Sets `ctx.meta.ip` from `x-forwarded-for` or socket address
- Sets `ctx.meta.userAgent`
- Response header: `X-Robots-Tag: noindex, nofollow`

### `authorize`

- Sets `ctx.meta.origin`
- If `req.$action.auth === "required"` and `ctx.meta.user` is missing → unauthorized
- Errors surface as 401: session expired message

`ctx.meta.user` is expected to be set by upstream JWT middleware (not the commented `authenticate` stub in this file).

## CORS

- `origin: "*"` — restrict in production
- Methods: GET, OPTIONS, POST, PUT, DELETE
- Headers include `Authorization`, `x-domain`, `platform`, `version`, etc.

## Socket.IO (`started`)

- Server attached to HTTP `this.server`
- CORS: `CLIENT_URL`, Socket.IO admin UI
- Admin UI: `auth: false`, `readonly: true`, `development` mode
- On connect: emits `welcome`; logs `disconnect`

## Logging

- Request params and response data at `info`
- 4xx responses not logged as errors

## Production checklist

1. Wire JWT / session into `ctx.meta.user` before `authorize`.
2. Lock CORS to known frontends.
3. Disable or protect Socket.IO admin UI outside dev.
4. Add rate limiting at gateway or load balancer.
