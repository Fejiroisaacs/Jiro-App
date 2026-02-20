# Jiro

Just life FeJiro, get it? :)

## Modules

| Module | Status | Description |
| ------ | ------ | ----------- |
| **Culinara** | Done | Recipe management, cook mode, trial logging, shopping list |
| **Jym** | Done | Gym tracking — splits, sessions, sets, PRs, body weight |
| **Echo** | Planned | Reminders and recurring tasks |
| **Ledger** | Planned | Finance tracking — income, expenses, budgets, net worth |
| **Folio** | Planned | Journaling and reflections |

## Stack

| Layer | Technology |
| ----- | ---------- |
| Backend | Go 1.25, Gin, PostgreSQL 16 |
| Frontend | Angular 21, Signals, CSS custom properties |
| Auth | JWT (15 min) + httpOnly refresh cookie (7 days) |
| Database | PostgreSQL via Docker |
| Object Storage | Cloudflare R2 (planned) |
| Hosting | GCP Cloud Run (planned) |

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
