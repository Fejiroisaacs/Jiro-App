# Navigation Redesign — Contextual Bottom Nav

## Summary

Replace the fixed global bottom nav (all apps always visible) with a contextual bottom nav that adapts to the current app. Each app owns its bottom nav. The hub becomes a dedicated destination.

## Problem

Current design has two stacked navigation layers:
1. Global bottom nav (all apps)
2. Per-app quick nav (tabs at top of each app)

This creates cognitive overhead — users track "where am I globally" AND "where am I within this app" simultaneously. Redundant navigation also eats screen real estate.

## Solution

Single bottom nav that transforms per context. Hub gets a minimal nav. Each app gets its own nav with sections consolidated by user intent.

---

## Navigation Structure

### Hub (app center)
```
[ Home ] [ Guide ] [ Settings ]
```

### Jym
```
[ Jiro ] [ Jym ] [ Train ] [ Plan ] [ Track ]
```

| Tab | Contains | Sub-navigation |
|-----|----------|----------------|
| Jiro | Returns to hub | — |
| Jym | Dashboard (activity, muscle groups, active series, splits shortcuts) | — |
| Train | Exercise Library + PRs | Top tabs: Exercises \| PRs |
| Plan | Splits + Series + Templates | Top tabs: Splits \| Series \| Templates |
| Track | Session History + Body Weight | Top tabs: Sessions \| Body Weight |

**Discover** lives inside Plan → Splits tab (community splits).

**Drill-down pages** (Split Detail, Exercise Detail, Series Detail, Session Player, Session Summary) use push navigation — bottom nav stays visible, back gesture returns to parent.

### Other apps (future)
Same pattern: `[ Jiro ] [ App Home ] [ ...app tabs ]`

---

## Key Decisions

| Decision | Alternatives considered | Why chosen |
|----------|------------------------|------------|
| Contextual bottom nav | Keep global nav | Reduces cognitive load, gives each app independence, eliminates dual-nav layers |
| Top tabs for sub-sections (Train/Plan/Track) | Nested routes, bottom sheets | Familiar mobile pattern, no new interaction model, URL stays clean |
| Discover inside Plan → Splits | Dedicated nav item | Low-frequency feature, naturally discovered when managing splits |
| No Guide tab in Jym | Guide in bottom nav | Guide is low-frequency; hub Guide section covers all apps |
| 2-tap cross-app switch | Keep 1-tap global nav | Users rarely switch apps mid-session; isolation benefit outweighs tap cost |
| Rename to Train/Plan/Track | Keep existing labels | Intent-based grouping eliminates "More" overflow, cleaner IA |

---

## Assumptions

- This redesign is mobile-only (bottom nav is already hidden on desktop)
- Pattern will be applied to Culinara, Journaly, Ledger in future iterations
- Icons: existing SVGs reused for now; custom icons to be added later
- No emojis — SVG only throughout

---

## Non-goals

- No desktop navigation changes
- No new pages created (existing pages reorganized, not rebuilt)
- No animation/transition spec (out of scope for this design)
- Other apps' specific nav tabs not designed yet
