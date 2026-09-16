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
