-- Category colours become data palette keys (data-1 to data-12) so they follow the theme.
ALTER TABLE ledger_categories ALTER COLUMN color TYPE VARCHAR(16) USING rtrim(color);

-- The old default palette, mapped by hue family.
WITH defaults(hex, key) AS (VALUES
  ('#8D6E63', 'data-12'), ('#E57373', 'data-1'),  ('#64B5F6', 'data-5'),
  ('#81C784', 'data-4'),  ('#FFD54F', 'data-3'),  ('#F48FB1', 'data-6'),
  ('#90A4AE', 'data-10'), ('#CE93D8', 'data-9'),  ('#BCAAA4', 'data-7'),
  ('#66BB6A', 'data-8'),  ('#4DB6AC', 'data-4'),  ('#FFA726', 'data-11'),
  ('#AB47BC', 'data-6'),  ('#78909C', 'data-10')
)
UPDATE ledger_categories c SET color = d.key
FROM defaults d WHERE upper(c.color) = d.hex;

-- Any other hex goes to the nearest key by hue; greys go to the neutral keys.
WITH rgb AS (
  SELECT id,
         ('x' || substr(color, 2, 2))::bit(8)::int AS r,
         ('x' || substr(color, 4, 2))::bit(8)::int AS g,
         ('x' || substr(color, 6, 2))::bit(8)::int AS b
  FROM ledger_categories WHERE color ~ '^#[0-9A-Fa-f]{6}$'
), hsl AS (
  SELECT id, greatest(r, g, b) - least(r, g, b) AS chroma,
         CASE
           WHEN greatest(r, g, b) = least(r, g, b) THEN 0
           WHEN greatest(r, g, b) = r THEN mod((60.0 * (g - b) / (greatest(r, g, b) - least(r, g, b)) + 360)::numeric, 360)
           WHEN greatest(r, g, b) = g THEN 60.0 * ((b - r)::numeric / (greatest(r, g, b) - least(r, g, b)) + 2)
           ELSE 60.0 * ((r - g)::numeric / (greatest(r, g, b) - least(r, g, b)) + 4)
         END AS hue
  FROM rgb
), hues(key, hue, n) AS (VALUES
  ('data-1', 13, 1), ('data-2', 82, 2), ('data-3', 38, 3), ('data-4', 138, 4), ('data-5', 207, 5),
  ('data-6', 341, 6), ('data-8', 133, 8), ('data-9', 21, 9), ('data-11', 39, 11), ('data-12', 22, 12)
), pick AS (
  SELECT DISTINCT ON (h.id) h.id,
         CASE WHEN h.chroma < 30 THEN CASE WHEN h.chroma = 0 OR h.hue BETWEEN 90 AND 300 THEN 'data-10' ELSE 'data-7' END
              ELSE k.key END AS key
  FROM hsl h CROSS JOIN hues k
  ORDER BY h.id, least(abs(h.hue - k.hue), 360 - abs(h.hue - k.hue)), k.n
)
UPDATE ledger_categories c SET color = p.key FROM pick p WHERE c.id = p.id;

-- Missing or unreadable colours take the neutral key.
UPDATE ledger_categories SET color = 'data-10'
WHERE color IS NULL OR color !~ '^data-([1-9]|1[0-2])$';
