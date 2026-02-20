# Technical Design Document: Jiro Platform (Base)

## 1. Summary

Jiro is a modular, self-hosted "Life OS" designed to centralize personal utilities. It uses a **Microservices** architecture to allow independent scaling and distinct tech stacks for specific problems (e.g., Python for AI, Go for Core Logic).

## 2. Architecture

The system follows a **Hub-and-Spoke** topology.

### 2.1 High-Level Diagram

* **Frontend (The Shell):** Angular v17+. Acts as a container that loads different "Modules" (Echo, Culinara, Jym) lazily.
* **API Gateway (The Hub):** Go (Gin). Handles Auth, Routing, and business logic. Chosen for single-binary deployment, goroutine concurrency, and fast development velocity.
* **AI Service:** Python (FastAPI). Isolated service for Gemini SDK integration and text processing.
* **Storage Layer:**
  * **Structured Data:** PostgreSQL (User data, relational links, JSONB for semi-structured fields).
  * **Blob Data:** Cloudflare R2 (S3-compatible, 10GB free, no egress fees). Fallback: MinIO for fully self-hosted setups.

## 3. Tech Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | Angular v17+ + TypeScript | Strong typing, modular lazy-loaded architecture, built-in DI/routing/forms. |
| **Backend** | Go 1.22+ (Gin) | Single-binary deployment, goroutines for concurrent tasks, fast compile times, excellent PostgreSQL drivers (pgx), rich web middleware ecosystem. |
| **AI Service** | Python (FastAPI) | Google Gemini SDK support, ease of text processing, async-native. |
| **Database** | PostgreSQL 16+ | Reliability, complex relational queries, JSONB support for semi-structured data. |
| **Object Store** | Cloudflare R2 | S3-compatible API, 10GB free tier, zero egress fees. |
| **Migrations** | golang-migrate | Numbered SQL migration files, forward/backward, CI-friendly. |

## 4. Shared Services

### 4.1 Authentication

* **Access Token:** Short-lived JWT (15 min) issued by the Go backend. Stateless validation via middleware.
* **Refresh Token:** Long-lived (7 days), stored in an httpOnly secure cookie. Stored hashed in the `refresh_tokens` table for revocation support.
* **Flow:** Login → receive access token (JSON body) + refresh token (httpOnly cookie) → use access token for API calls → on 401, hit `/api/v1/auth/refresh` to rotate both tokens.

### 4.2 Design System ("Earth & Clay")

* Global CSS Variables defined in `styles.scss`.
* Standard components (Cards, Modals, Buttons) in a `shared/ui` Angular library.
* Palette: Nude tones — brown, maroon, green, sand.

## 5. Cross-Cutting Concerns

### 5.1 API Versioning

All routes prefixed with `/api/v1/`. Breaking changes get a new version prefix.

### 5.2 Error Response Contract

All errors follow a standard envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Recipe with ID abc-123 does not exist."
  }
}
```

### 5.3 Observability

* Structured JSON logging (zerolog) with request ID propagation.
* Health endpoint (`GET /api/v1/health`) checks DB, R2, and AI service connectivity.

### 5.4 Security

* **CORS:** Explicit allowlist of frontend origins. No wildcard in production.
* **Rate Limiting:** Token bucket on auth endpoints (10 req/min per IP). General rate limit on all other endpoints (100 req/min per user).
* **Input Validation:** All request bodies validated at the handler level before reaching business logic.

### 5.5 Multi-Tenancy

Every domain table includes a `user_id UUID REFERENCES users(id)` column. The auth middleware injects the authenticated user ID into the request context, and all queries filter by it. No user can access another user's data.

## 6. Hosting & Deployment (GCP)

| Component | GCP Product | Cost |
| :--- | :--- | :--- |
| Go API | Cloud Run | $0 (free tier) |
| FastAPI AI | Cloud Run | $0 (free tier) |
| PostgreSQL | e2-micro VM (free tier) | $0 |
| Object Storage | Cloudflare R2 | $0 (10GB free) |
| Echo Scheduler | Cloud Scheduler → Cloud Run | $0 |
| Container Registry | Artifact Registry | $0 (500MB free) |

* Each service is containerized (Dockerfile) and deployed independently.
* PostgreSQL runs on a dedicated e2-micro VM with automated `pg_dump` backups to Cloud Storage.
* Cloud Scheduler triggers the Echo tick endpoint with a service account token (authenticated, not public).
* CI/CD: GitHub Actions → build Docker images → push to Artifact Registry → deploy to Cloud Run.
