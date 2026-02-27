# Upcoming Features

Planned features across all Jiro modules, in rough priority order.

---

## Jym

- **Deload auto-suggest** — after N consecutive sessions without a PR or with declining volume, suggest scheduling a deload week

---

## Base / Cross-module

- **Dashboard widgets** — customisable cards on the dashboard: last workout, recent recipes, body weight trend, upcoming reminders
- **Global search** — search across recipes, exercises, and sessions from anywhere in the app
- **Data export** — full account export as JSON (all modules)

---

## Echo (reminders module — not yet started)

See `docs/ECHO-DESIGN-DOC.md` for the full design. High-level planned features:

- RFC 5545 RRULE recurring reminders
- Multi-channel delivery: push notification (PWA), email
- Reminder templates (e.g. "rest day", "meal prep Sunday")
- Snooze and dismiss from notification

---

## Journaling module — planned

- Daily journal entries with mood tagging
- Free-form text with optional structured prompts
- Entry streaks and calendar view
- Private by default, no sharing
- Attach images to journal entries (object key: `journal/{user_id}/{entry_id}/{uuid}.{ext}`, max 3 per entry, 10 MB each)
