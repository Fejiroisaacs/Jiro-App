# Jiro

Just like FeJiro, get it? :)

**Live App:** [jiro-app](https://jiro-app-3e88c.web.app)

## Modules

| Module | Status | Description |
| ------ | ------ | ----------- |
| **Culinara** | Done | Recipe management, cook mode, trial logging, shopping list |
| **Jym** | Done | Gym tracking — splits, sessions, sets, PRs, body weight |
| **Echo** | Planned | Reminders and recurring tasks |
| **Ledger** | Planned | Finance tracking — income, expenses, budgets, net worth |
| **Journaly** | Planned | Journaling and reflections |

## Stack

| Layer | Technology |
| ----- | ---------- |
| Backend | Go 1.25, Gin |
| Frontend | Angular 21, Signals, CSS custom properties |
| Auth | JWT (15 min) + httpOnly refresh cookie (7 days) |
| Database | PostgreSQL via Docker (local) / Neon (production) |
| Email | Resend (planned — password reset, notifications) |
| Object Storage | Cloudflare R2 (planned) |
| Hosting | GCP Cloud Run (API) + Firebase Hosting (frontend) |

## API Security

### Rate Limiting

All limits use an in-process token bucket (burst = limit, refill = limit/min). Exceeding a limit returns `429 RATE_LIMITED`.

| Route group | Key | Limit |
| ----------- | --- | ----- |
| `POST /auth/*` (login, register, reset…) | Client IP | 10 req/min |
| Public read endpoints (profiles, shares, public splits) | Client IP | 60 req/min |
| All authenticated (`/api/v1/*` with JWT) | User ID | 300 req/min |
| Upload presign (`/upload/*/presign`) | User ID | 20 req/min (additive) |
| `GET /health` | — | none |
| Admin (`/admin/*`) | — | none (secret header required) |

The presign limit is additive — a user must satisfy **both** the 300/min general limit and the 20/min presign limit to generate a new upload URL.

### Authentication

- JWT access tokens expire after **15 minutes**
- Refresh tokens are httpOnly cookies, valid for **7 days**, SHA-256 hashed in the database
- Passwords hashed with **Argon2id**

## Repos

```text
Jiro-App/
├── jiro-api/   # Go REST API
└── jiro-ui/    # Angular frontend
```

- [jiro-api/README.md](jiro-api/README.md) — backend setup, commands, API reference
- [jiro-ui/README.md](jiro-ui/README.md) — frontend setup, commands, route reference

## Quick Start

**1. Start the database**

```bash
docker start jiro-postgres
```

First time:

```bash
docker run -d \
  --name jiro-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=jiro \
  -p 5432:5432 \
  postgres:16
```

**2. Start the API** (from `jiro-api/`)

```bash
go run ./cmd/server/main.go
```

**3. Run migrations** (from `jiro-api/`)

```bash
go run ./cmd/migrate/main.go
```

**4. Start the UI** (from `jiro-ui/`)

```bash
ng serve
```

App runs at `http://localhost:4200`.

---

## Production Deployment

### Deploy the API (Cloud Run)

Cloud Run deploys automatically from GitHub via Cloud Build. To trigger a new build, push to `main`:

```bash
git push origin main
```

Cloud Build will rebuild the container from `jiro-api/Dockerfile` and deploy it to Cloud Run.

To update environment variables (e.g. `CORS_ORIGINS`, `DATABASE_URL`) without rebuilding:

1. Go to Cloud Run → your service → **Edit & Deploy New Revision**
2. Update variables under the **Variables & Secrets** tab
3. Click **Deploy**

### Deploy the Frontend (Firebase Hosting)

From the project root:

```bash
cd jiro-ui && ng build && cd ..
firebase deploy --only hosting
```

### Run Database Migrations (Neon)

New migration files must be applied manually. Open the [Neon SQL Editor](https://console.neon.tech) and paste the contents of each new `.up.sql` file from `jiro-api/migrations/` in order.

Or use psql:

```bash
psql "postgresql://user:pass@host/dbname?sslmode=require" -f jiro-api/migrations/000011_example.up.sql
```
