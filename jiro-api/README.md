# Jiro API

Backend for the Jiro Life OS platform. Built with Go, Gin, and PostgreSQL.

## Tech Stack

| Component | Choice |
|-----------|--------|
| Language | Go 1.25 |
| Framework | Gin |
| Database | PostgreSQL 16 (pgx/v5 pool) |
| Auth | JWT (access) + httpOnly cookie (refresh) |
| Password hashing | Argon2id |
| Logging | zerolog |

---

## Prerequisites

- Go 1.25+
- PostgreSQL 16 (via Docker — see below)
- `.env` file in `jiro-api/` (see Environment Variables)

---

## Environment Variables

Copy and customise for local dev:

```env
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/jiro?sslmode=disable
JWT_SECRET=change-me-in-production
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
CORS_ORIGINS=http://localhost:4200
ENVIRONMENT=development
```

All variables have sensible defaults so the server starts without a `.env` file in development.

---

## Commands

All commands are run from the `jiro-api/` directory.

### Run the server

```bash
go run ./cmd/server/main.go
```

On Windows (PowerShell):

```powershell
powershell.exe -Command "Set-Location 'C:\Users\fejir\OneDrive\Documents\Project\Fejiro-App\jiro-api'; & 'C:\Program Files\Go\bin\go.exe' run ./cmd/server/main.go"
```

### Run database migrations

```bash
go run ./cmd/migrate/main.go
```

Migrations live in `migrations/` as numbered `.up.sql` / `.down.sql` pairs. The runner tracks applied versions in a `schema_migrations` table and skips already-applied ones.

### Build a binary

```bash
go build -o jiro-api ./cmd/server/main.go
./jiro-api
```

### Run tests

```bash
go test ./...
```

### Download / tidy dependencies

```bash
go mod tidy
go mod download
```

### Vet and lint

```bash
go vet ./...
```

---

## Database (Docker)

Start the Postgres container:

```bash
docker start jiro-postgres
```

First-time setup (creates the container):

```bash
docker run -d \
  --name jiro-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=jiro \
  -p 5432:5432 \
  postgres:16
```

Open a psql shell:

```bash
docker exec -it jiro-postgres psql -U postgres -d jiro
```

Apply a single migration manually:

```bash
docker exec -i jiro-postgres psql -U postgres -d jiro < migrations/000010_recipe_tags.up.sql
```

---

## Project Structure

```
jiro-api/
├── cmd/
│   ├── server/       # Entrypoint — starts Gin server
│   └── migrate/      # Migration runner
├── internal/
│   ├── config/       # Env/config loading
│   ├── database/     # pgxpool connection
│   ├── handlers/     # HTTP handlers (auth, user, culinara, jym, health)
│   ├── middleware/   # Auth, CORS, rate limiting
│   ├── models/       # Shared structs / domain types
│   ├── router/       # Route registration
│   └── services/     # Business logic
├── migrations/       # Numbered .up.sql / .down.sql files
├── go.mod
└── .env              # Local config (not committed)
```

---

## API

Base URL: `http://localhost:8080/api/v1`

### Auth — `/auth` (rate limited: 10 req/min per IP)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login, returns JWT + sets refresh cookie |
| POST | `/auth/refresh` | Refresh access token using cookie |
| POST | `/auth/logout` | Invalidate refresh token |

### User — requires JWT

| Method | Path | Description |
|--------|------|-------------|
| GET | `/user/me` | Get current user profile |
| PATCH | `/user/me` | Update profile / settings |

### Culinara — requires JWT

| Method | Path | Description |
|--------|------|-------------|
| POST | `/culinara/recipes` | Create recipe |
| GET | `/culinara/recipes` | List recipes |
| GET | `/culinara/recipes/:id` | Get recipe |
| PUT | `/culinara/recipes/:id` | Update recipe |
| DELETE | `/culinara/recipes/:id` | Delete recipe |
| POST | `/culinara/recipes/:id/trials` | Log a trial |
| PUT | `/culinara/trials/:id` | Update trial |
| DELETE | `/culinara/trials/:id` | Delete trial |
| POST | `/culinara/promote/:trial_id` | Promote trial → base recipe |

### Jym — requires JWT

| Method | Path | Description |
|--------|------|-------------|
| POST | `/jym/exercises` | Create exercise |
| GET | `/jym/exercises` | List exercises |
| GET | `/jym/exercises/:id` | Get exercise + set history |
| PUT | `/jym/exercises/:id` | Update exercise |
| DELETE | `/jym/exercises/:id` | Delete exercise |
| GET | `/jym/prs` | Get personal records (max weight per exercise) |
| POST | `/jym/splits` | Create split |
| GET | `/jym/splits` | List splits |
| GET | `/jym/splits/:id` | Get split with routines |
| PUT | `/jym/splits/:id` | Update split |
| DELETE | `/jym/splits/:id` | Delete split |
| POST | `/jym/splits/:split_id/routines` | Create routine in split |
| PUT | `/jym/routines/:id` | Update routine |
| DELETE | `/jym/routines/:id` | Delete routine |
| PUT | `/jym/routines/:id/items` | Replace routine exercise list |
| POST | `/jym/sessions` | Start session |
| GET | `/jym/sessions` | List sessions |
| GET | `/jym/sessions/:id` | Get session with sets |
| PATCH | `/jym/sessions/:id` | Update session (finish, note, etc.) |
| DELETE | `/jym/sessions/:id` | Delete session |
| POST | `/jym/sessions/:id/sets` | Log a set |
| PUT | `/jym/sets/:id` | Update set |
| DELETE | `/jym/sets/:id` | Delete set |
| POST | `/jym/bodyweights` | Log body weight |
| GET | `/jym/bodyweights` | List body weight entries |
| DELETE | `/jym/bodyweights/:id` | Delete body weight entry |
| POST | `/jym/series` | Create split series |
| GET | `/jym/series` | List split series |
| GET | `/jym/series/:id` | Get series |
| PATCH | `/jym/series/:id` | Update series |
| DELETE | `/jym/series/:id` | Delete series |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | DB connectivity check |

---

## Auth Flow

1. `POST /auth/login` → returns `access_token` (JWT, 15 min) in body + sets `refresh_token` httpOnly cookie (7 days, SHA-256 hashed in DB)
2. All protected routes require `Authorization: Bearer <access_token>`
3. When the access token expires, `POST /auth/refresh` exchanges the cookie for a new access token (rotating refresh)
4. `POST /auth/logout` deletes the refresh token from the DB and clears the cookie
