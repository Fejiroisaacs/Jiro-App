# Guide screenshots

Screenshots for the in-app guides (/guide/...), taken from the demo account in
light and dark. Each guide has its own shot list, so guides can be shot in
parallel without editing the same file:

    basics.shots.json  jym.shots.json  culinara.shots.json  journaly.shots.json  ledger.shots.json

Needs: the API on :8080, `npx ng serve` on :4200, the global `playwright-cli`,
Python 3 with Pillow.

## Re-shoot a guide

From `jiro-ui/`:

    node scripts/guide-shots/capture.mjs jym            # every shot in jym.shots.json
    node scripts/guide-shots/capture.mjs jym plan-page  # only the named shots
    python scripts/guide-shots/to-webp.py jym           # or: to-webp.py jym plan-page

`capture.mjs` signs in to the demo once (the landing page's Try the demo
button), hides the demo bar and toasts, and writes
`.raw/<guide>/<name>-light.png` and `-dark.png` at 2x. `.raw/` is not committed.

`to-webp.py` writes `public/images/guide/<guide>/<name>-light.webp` and
`-dark.webp` (at most 1600px wide, under 120 KB each) and prints each file's
width and height. Copy those into the page:

    <guide-shot guide="jym" name="plan-page" [width]="1600" [height]="1000" alt="..." />

The image is shown at no more than half its pixel width, which is its real
size on screen.

## Add a shot

Add an entry to the guide's shot list, then capture it by name.

    {
      "name": "plan-page",
      "path": "/jym/plan",
      "waitFor": "main.content h1",
      "actions": [
        { "click": { "role": "button", "name": "New split" } },
        { "fill": "input[name=name]", "value": "Upper lower" },
        { "press": "Tab" },
        { "wait": 500 },
        { "scroll": ".some-card" }
      ],
      "clip": ".modal-content",
      "viewport": { "width": 390, "height": 844 },
      "hide": [".some-badge"]
    }

Only `name` and `path` are required.

- `name`: lowercase-with-dashes, unique in the list. It becomes the file name.
- `path`: the app URL to open.
- `waitFor`: a CSS selector to wait for before anything else.
- `actions`: run in order. `click` takes a CSS selector or `{ "role", "name" }`
  (add `"exact": true` for an exact name match). `fill` takes a selector and a
  `value`. `press` takes a key such as `Control+k` or `Escape`. `wait` takes
  milliseconds. `scroll` scrolls a selector into view.
- `clip`: a CSS selector for the element to capture. It is scrolled into view
  and cut to the viewport if it is bigger. Without it, the shot is the main
  content area (no sidebar, and on a phone no top or bottom bar) as far as the
  viewport shows it. Use `"clip": "body"` for a whole phone screen.
- `viewport`: default 1280 by 800. For a phone, use 390 by 844.
- `hide`: extra selectors to hide.

Keep shots tight: a dialog or one card reads better than a whole page, and
stays under the size budget.
