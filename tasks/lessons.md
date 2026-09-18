# Lessons

## 2026-09-16 — Phase 3a (Jym)

**Subagents stall on this repo's big components.** Three background agents were
given the mechanical Jym refactor and all three died before writing a single
edit: two hit the stream watchdog, one hit a spend limit. The Jym pages are
single files of 700 to 1900 lines with the template and styles inline, so an
agent burns its whole budget just reading them.
**How to apply:** for repetitive edits across large single-file Angular
components, do them inline with Python string replacements that assert an exact
match count, rather than spawning agents. Reserve agents for read-only
exploration, which did work well here.

**Assert the match count on every scripted replacement.** Every edit script in
this phase checked `s.count(old) == expected` before replacing and printed a
failure instead of writing. That caught two silent misses (a heading whose
indentation differed, an import anchor that did not exist in one of three
files) that a plain `str.replace` would have swallowed.

**Do not run a blanket regex over a file that also contains library config.**
A global colour-token pass rewrote Chart.js option strings such as
`grid: { color: 'rgba(0,0,0,0.05)' }` into `var(--shadow-rgb)`, which Chart.js
cannot resolve, so the grid lines would have silently disappeared.
**How to apply:** when tokenising colours, split the file at the `styles: [` block
and only rewrite inside it; handle library configuration deliberately, reading
tokens through `getComputedStyle` where the library needs plain strings.

**Verify contrast against the rendered page, not by reasoning.** The first fix
for the dark-mode bar chips used `currentColor` as the chip's `background`. In a
background, `currentColor` resolves to the element's own `color`, so the chip
became invisible; only measuring the live page caught it. The measuring script
then mis-parsed `color(srgb 1 1 1 / 0.88)` as 0-255 values and reported a false
failure in light mode.
**How to apply:** measure on the running app, and make the probe handle both
`rgb()/rgba()` and `color(srgb ...)` before trusting a number.

## Parallel agents, roadmap builds (2026-09-17)

**A subagent's own caveat list is a to-do list, not a disclaimer.** Four agents
reported honestly, and three of their caveats were real defects: an export that
upserted a database row on GET, an export that silently truncated at 50
sessions, and a rule that fired on a 0.3% drift. Each was written up as a note
rather than a bug, and each would have shipped if the note had been read as
"known limitation".
**How to apply:** read every caveat as a question — does this break the promise
the feature makes? An export that stops at 50 breaks "everything the account
holds"; a read that writes breaks "download my data". Fix those before
committing, and only downgrade to a note when the promise still holds.

**A rule with no threshold is a rule that fires on noise.** "Volume trends
down" with a strict comparison triggers on any decline at all. Ask what the
natural variation of the signal is, and put a floor above it, or the feature
becomes something the user learns to dismiss unread.

**Check whether a service is a stub before testing against it.** Local dev here
points at a live Cloudflare R2 bucket, so an end-to-end upload test would have
written and deleted real objects in the user's own storage. `NewStorageService`
returning a no-op when keys are absent made it look local.
**How to apply:** probe the service first (a presign told me the host), then
choose what is safe to exercise unattended and verify the destructive path by
reading the code. Say plainly in the review which path was not fired and why.

**`playwright-cli` sessions do not survive between separate tool calls here.**
Several checks failed with "Browser 'x' is not open" after working once. Put the
whole browser pass in one script that opens the session, injects
`jiro_token`/`jiro_user`, and runs every assertion in a single invocation.

**One file per agent is not always possible; plan the commit split up front.**
`router.go` was shared by the covers and export builds, and `services/jym.go` by
the deload and export builds. Splitting them afterwards meant saving the full
file, scripting out one build's block with an asserted count, committing, and
restoring — then building each commit in a throwaway `git worktree` to prove it
compiles on its own. Cheaper to assign shared files to one agent and have the
others state the lines to add.

**Do the work; a blocker is not a deliverable.** `npm audit fix` failed with
EBUSY because the user's `ng serve` held `esbuild.exe`. I stopped, left nine
advisories unfixed, and reported the blocker as if it were a result. The user's
answer: restart the server and test, and ask if there's an issue. Reporting an
obstacle I had the tools to clear is not finishing the task — and "verified" on
a dependency upgrade means the app actually ran, not that the build exited 0.
**How to apply:** when a dev server or lock blocks a step, stop it, complete the
step, restart it, and verify the running app. If stopping something genuinely
might cost the user (unsaved state, a long job), ask — do not silently downgrade
the task to a status report. Applies to the whole class: a locked file, a held
port, a container that needs a restart.

**Findings from parallel subagents go stale while they run.** Seven of the user's
own commits landed during a six-agent audit; one added the exact `firebase.json`
security headers that two agents had just reported missing, so I nearly "fixed"
finished work and did tell him a gap existed that he had closed.
**How to apply:** re-read the specific lines before editing anything a subagent
flagged, and run `git log --oneline <start-sha>..HEAD` before writing the report.
Correct stale claims explicitly rather than letting them stand.

**Verify the SQL, not just the compile.** A helper I added queried a `series`
table that does not exist — the real name is `split_series`. Go compiles string
SQL happily, so `go build` and `go vet` both passed and only a smoke test would
have caught it. Two other new checks returned 500/400 instead of 404 because the
handlers had no mapping for the sentinels the service now returns.
**How to apply:** after adding any query, check the table and column names
against `\d <table>` and run the path. When a service starts returning a new
sentinel error, grep its handler for the mapping in the same change.
