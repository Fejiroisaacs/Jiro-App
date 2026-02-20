# Technical Design Document: Echo (Notification Engine)

## 1. Problem Statement

Standard calendar apps are passive. The user needs an *active* reminder system that pushes alerts via multiple channels (SMS, Email, Push) to ensure critical tasks are not missed.

## 2. Functional Requirements

* **FR1:** User can create one-time and recurring reminders.
* **FR2:** System must support "Snooze" functionality with a configurable snooze duration.
* **FR3:** System must deliver notifications via Email (SMTP/SendGrid), Web Push (VAPID), and SMS (Twilio).
* **FR4:** System must handle "Quiet Hours" (defer non-urgent alerts until the window ends).
* **FR5:** System must log all delivery attempts with success/failure status for debugging.
* **FR6:** Failed deliveries must be retried up to 3 times with exponential backoff.

## 3. Data Schema (`schema_echo.sql`)

```sql
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    recurrence_rule VARCHAR(255),       -- RFC 5545 RRULE (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
    timezone VARCHAR(50) NOT NULL,      -- IANA timezone (e.g., "America/New_York"), sourced from user profile
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, SNOOZED, PAUSED
    snoozed_until TIMESTAMP WITH TIME ZONE, -- When to re-fire after snooze (NULL if not snoozed)
    channels JSONB NOT NULL,            -- ["email", "push", "sms"]
    priority VARCHAR(10) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH (HIGH bypasses quiet hours)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,       -- "email", "push", "sms"
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL,        -- SENT, FAILED, RETRYING
    retry_count INT DEFAULT 0,          -- max 3 retries
    error_message TEXT                   -- NULL on success, error details on failure
);

CREATE INDEX idx_reminders_due ON reminders(due_at) WHERE status = 'PENDING';
CREATE INDEX idx_reminders_snoozed ON reminders(snoozed_until) WHERE status = 'SNOOZED';
CREATE INDEX idx_reminders_user ON reminders(user_id);
```

## 4. Recurrence Strategy

**Standard: RFC 5545 RRULE** (not cron). RRULE is the calendar industry standard and supports complex patterns that cron cannot express:

* "Every 2nd Tuesday" → `FREQ=MONTHLY;BYDAY=2TU`
* "Last Friday of every month" → `FREQ=MONTHLY;BYDAY=-1FR`
* "Every weekday" → `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`

Go libraries: `teambition/rrule-go` for parsing and next-occurrence calculation.

## 5. Scheduler Security

The `/api/v1/echo/tick` endpoint is triggered by GCP Cloud Scheduler every minute. It is **not publicly accessible**:

* Authenticated via GCP service account OIDC token.
* The Go middleware validates the token's `email` claim matches the expected service account.
* Requests from any other source return 403.
