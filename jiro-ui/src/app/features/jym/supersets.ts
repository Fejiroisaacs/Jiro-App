/** Supersets: adjacent items with the same group number. Same rule as the API's normalizeGroups. */
export type Group = number | null;

/** Each run of two or more equal groups is a superset, numbered 1, 2, 3 in order; a member on its own is ungrouped. */
export function normalizeGroups(groups: readonly Group[]): Group[] {
  const out: Group[] = groups.map(() => null);
  let next = 1;
  for (let i = 0; i < groups.length;) {
    const g = groups[i];
    if (g == null) { i++; continue; }
    let j = i;
    while (j + 1 < groups.length && groups[j + 1] === g) j++;
    if (j > i) {
      for (let k = i; k <= j; k++) out[k] = next;
      next++;
    }
    i = j + 1;
  }
  return out;
}

/** The items with their groups normalized; an item whose group didn't change is kept as is. */
export function normalizeItems<T extends { superset_group: Group }>(items: readonly T[]): T[] {
  const groups = normalizeGroups(items.map(it => it.superset_group ?? null));
  return items.map((it, i) => (it.superset_group ?? null) === groups[i] ? it : { ...it, superset_group: groups[i] });
}

/** Whether item i and the next one are in the same superset. */
export function linkedWithNext(groups: readonly Group[], i: number): boolean {
  return i + 1 < groups.length && groups[i] != null && groups[i] === groups[i + 1];
}

/** Links item i with the next one, or unlinks them (splitting the superset there). */
export function toggleLink(groups: readonly Group[], i: number): Group[] {
  if (i + 1 >= groups.length) return normalizeGroups(groups);
  const out = [...groups];
  const fresh = Math.max(0, ...groups.map(g => g ?? 0)) + 1;
  if (linkedWithNext(groups, i)) {
    // The members after the joint become a run of their own.
    const g = groups[i];
    for (let k = i + 1; k < out.length && groups[k] === g; k++) out[k] = fresh;
  } else {
    const into = groups[i] ?? groups[i + 1] ?? fresh;
    out[i] = into;
    const h = groups[i + 1];
    if (h == null) out[i + 1] = into;
    else for (let k = i + 1; k < out.length && groups[k] === h; k++) out[k] = into;
  }
  return normalizeGroups(out);
}

/** "A1", "A2", "B1" for members of supersets, in order; null outside them. Expects normalized groups. */
export function groupLabels(groups: readonly Group[]): (string | null)[] {
  const seen = new Map<number, number>();
  return groups.map(g => {
    if (g == null) return null;
    const n = (seen.get(g) ?? 0) + 1;
    seen.set(g, n);
    return `${String.fromCharCode(64 + g)}${n}`;
  });
}

/** Runs of the list for display: a superset's members together, everything else one by one. */
export function segments(groups: readonly Group[]): { group: Group; indices: number[] }[] {
  const out: { group: Group; indices: number[] }[] = [];
  groups.forEach((g, i) => {
    const last = out.at(-1);
    if (g != null && last && last.group === g) last.indices.push(i);
    else out.push({ group: g, indices: [i] });
  });
  return out;
}

/**
 * What logging a working set of exercise i leads to. In a superset: the next member that still has sets to do,
 * with no rest; after the round (no later member has work) rest, then back to the first member with work.
 * Outside one: rest, and nothing to point to.
 */
export function roundStep(groups: readonly Group[], i: number, hasWork: (j: number) => boolean): { rest: boolean; next: number | null } {
  const g = groups[i];
  if (g == null) return { rest: true, next: null };
  let start = i;
  while (start > 0 && groups[start - 1] === g) start--;
  let end = i;
  while (end + 1 < groups.length && groups[end + 1] === g) end++;
  for (let j = i + 1; j <= end; j++) if (hasWork(j)) return { rest: false, next: j };
  for (let j = start; j <= end; j++) if (hasWork(j)) return { rest: true, next: j };
  return { rest: true, next: null };
}

/** The indices in i's superset (i alone outside one). */
export function membersOf(groups: readonly Group[], i: number): number[] {
  return segments(groups).find(s => s.indices.includes(i))?.indices ?? [i];
}
