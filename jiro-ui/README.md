# Jiro UI

Frontend for the Jiro Life OS platform. Built with Angular 21 using standalone components and signals.

## Tech Stack

| Component | Choice |
| --------- | ------ |
| Framework | Angular 21 (standalone components) |
| State | Angular Signals |
| Styling | CSS custom properties (no CSS framework) |
| Charts | Chart.js 4 |
| Drag & Drop | Angular CDK |
| HTTP | Angular HttpClient + interceptors |

---

## Prerequisites

- Node.js 20+
- npm 10+
- Jiro API running on `http://localhost:8080`

---

## Commands

All commands are run from the `jiro-ui/` directory.

### Start dev server

```bash
ng serve
```

Opens at `http://localhost:4200`. Hot-reloads on file changes.

### Build for production

```bash
ng build
```

Output goes to `dist/jiro-ui/`. Production build is optimised and minified.

### Build and watch (dev)

```bash
npm run watch
```

### Run tests

```bash
ng test
```

### Install dependencies

```bash
npm install
```

### Generate a component

```bash
ng generate component features/my-feature/my-component
```

---

## Project Structure

```text
jiro-ui/
├── public/
│   └── icons/              # Custom module SVG icons
│       ├── echo-icon.svg
│       ├── culinara-icon.svg
│       └── jym-icon.svg
├── src/
│   ├── app/
│   │   ├── app.ts          # Root component
│   │   ├── app.routes.ts   # Top-level lazy routes
│   │   ├── app.config.ts   # App providers (router, http)
│   │   ├── core/
│   │   │   ├── guards/     # authGuard, guestGuard
│   │   │   ├── interceptors/ # JWT attach + 401 refresh
│   │   │   └── services/   # AuthService, RecipeService, JymService, SettingsService
│   │   ├── shared/
│   │   │   └── components/ # Design system components
│   │   ├── layouts/
│   │   │   └── main-layout/ # App shell with sidebar nav
│   │   └── features/
│   │       ├── auth/       # Login, Register
│   │       ├── dashboard/  # Home
│   │       ├── settings/   # Account, Preferences, Theme
│   │       ├── culinara/   # Recipe module
│   │       └── jym/        # Gym module
│   ├── styles.scss         # Global styles + theme definitions
│   └── index.html
├── package.json
└── angular.json
```

---

## Routes

| Path | Component | Auth |
| ---- | --------- | ---- |
| `/login` | LoginComponent | Guest only |
| `/register` | RegisterComponent | Guest only |
| `/dashboard` | DashboardComponent | Required |
| `/settings` | SettingsComponent | Required |
| `/culinara` | RecipeListComponent | Required |
| `/culinara/shopping` | ShoppingListComponent | Required |
| `/culinara/:id` | RecipeDetailComponent | Required |
| `/jym` | SplitListComponent | Required |
| `/jym/splits/:id` | SplitDetailComponent | Required |
| `/jym/exercises` | ExerciseLibraryComponent | Required |
| `/jym/exercises/:id` | ExerciseDetailComponent | Required |
| `/jym/session/:id` | SessionPlayerComponent | Required |
| `/jym/sessions` | SessionHistoryComponent | Required |
| `/jym/bodyweight` | BodyWeightComponent | Required |
| `/jym/series` | SeriesListComponent | Required |
| `/jym/series/:id` | SeriesDetailComponent | Required |
| `/jym/prs` | PrWallComponent | Required |

---

## Shared Design System

Components live in `src/app/shared/components/`:

| Component | Selector | Notes |
| --------- | -------- | ----- |
| Button | `<jiro-button>` | Variants: `primary`, `secondary`, `danger` |
| Input | `<jiro-input>` | Wraps native input with label + error |
| Card | `<jiro-card>` | Surface container |
| Modal | `<jiro-modal>` | Overlay dialog |
| Star Rating | `<star-rating>` | 1–5 interactive stars |

### Theme

"Earth & Clay" design system with CSS custom properties. Theme is set by adding a class to `<html>`:

```text
html.theme-earth     html.theme-clay      html.theme-sand
html.theme-forest    html.theme-royal-blue html.theme-midnight
html.theme-crimson   html.theme-plum      html.theme-sage
html.theme-slate     html.theme-rust
```

Theme preference is persisted to the user's account via the API.

---

## Auth

- Access token stored in `localStorage` under key `jiro_token`
- User profile stored in `localStorage` under key `jiro_user`
- Auth interceptor attaches `Authorization: Bearer <token>` to all API requests
- On 401, the interceptor attempts a silent token refresh before retrying
- `authGuard` redirects unauthenticated users to `/login`
- `guestGuard` redirects authenticated users away from `/login` and `/register`
