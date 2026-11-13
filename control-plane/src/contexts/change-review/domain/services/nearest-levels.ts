import type { HunkLink } from '@change-review/domain/services/diff-facts';
import { LAYER_LINES } from '@change-review/domain/value-objects/stack-cohort.vo';

interface Arc {
  readonly to: number;
  capacity: number;
  readonly back: number;
}

const connected = (
  arcs: Arc[][],
  from: number,
  to: number,
  capacity: number,
) => {
  const forward = arcs[from];
  const backward = arcs[to];

  if (forward && backward) {
    forward.push({ to, capacity, back: backward.length });
    backward.push({ to: from, capacity: 0, back: forward.length - 1 });
  }
};

const reachedFrom = (
  arcs: readonly Arc[][],
  source: number,
): Map<number, { node: number; arc: number } | null> => {
  const reached = new Map<number, { node: number; arc: number } | null>([
    [source, null],
  ]);
  const queue = [source];

  for (let at = 0; at < queue.length; at++) {
    const node = queue[at] ?? source;

    for (const [index, arc] of (arcs[node] ?? []).entries()) {
      if (arc.capacity > 0 && !reached.has(arc.to)) {
        reached.set(arc.to, { node, arc: index });
        queue.push(arc.to);
      }
    }
  }

  return reached;
};

const sourceSide = (
  arcs: Arc[][],
  source: number,
  sink: number,
): Set<number> => {
  for (;;) {
    const reached = reachedFrom(arcs, source);

    if (!reached.has(sink)) {
      return new Set(reached.keys());
    }

    const path: Arc[] = [];

    for (let step = reached.get(sink); step; step = reached.get(step.node)) {
      const arc = arcs[step.node]?.[step.arc];

      if (arc) {
        path.push(arc);
      }
    }

    const bottleneck = Math.min(...path.map((arc) => arc.capacity));

    for (const arc of path) {
      arc.capacity -= bottleneck;
      const reverse = arcs[arc.to]?.[arc.back];

      if (reverse) {
        reverse.capacity += bottleneck;
      }
    }
  }
};

const BOUND = new Set<string>(['uses', 'removes', 'moves', 'tests']);
const boundsOf = (
  links: readonly HunkLink[],
  indexOf: ReadonlyMap<string, number>,
): [number, number][] =>
  links.flatMap((link): [number, number][] => {
    const user = indexOf.get(link.from);
    const used = indexOf.get(link.to);

    if (
      !BOUND.has(link.kind) ||
      user === undefined ||
      used === undefined ||
      user === used
    ) {
      return [];
    }

    return link.kind === 'moves'
      ? [
          [used, user],
          [user, used],
        ]
      : [[used, user]];
  });

const fitted = (
  links: readonly HunkLink[],
  preferred: ReadonlyMap<string, number>,
  linesOf: (hunk: string) => number,
): Map<string, number> => {
  const hunks = [...preferred.keys()];
  const below = boundsOf(links, new Map(hunks.map((hunk, at) => [hunk, at])));
  const thresholds = [...new Set(preferred.values())]
    .sort((a, b) => a - b)
    .slice(0, -1);
  const levels = hunks.map(() => 0);
  const [source, sink] = [hunks.length, hunks.length + 1];

  for (const threshold of thresholds) {
    const arcs: Arc[][] = Array.from({ length: hunks.length + 2 }, () => []);

    for (const [at, hunk] of hunks.entries()) {
      const weight = Math.max(1, linesOf(hunk));

      if ((preferred.get(hunk) ?? 0) > threshold) {
        connected(arcs, source, at, weight);
      } else {
        connected(arcs, at, sink, weight);
      }
    }
    for (const [lower, upper] of below) {
      connected(arcs, lower, upper, Number.POSITIVE_INFINITY);
    }
    for (const at of sourceSide(arcs, source, sink)) {
      if (at < hunks.length) {
        levels[at] = (levels[at] ?? 0) + 1;
      }
    }
  }

  return new Map(hunks.map((hunk, at) => [hunk, levels[at] ?? 0]));
};

const reachedOver = (next: readonly number[][], start: number): Set<number> => {
  const reached = new Set([start]);
  const queue = [start];

  for (let at = 0; at < queue.length; at++) {
    for (const each of next[queue[at] ?? start] ?? []) {
      if (!reached.has(each)) {
        reached.add(each);
        queue.push(each);
      }
    }
  }

  return reached;
};

const packed = (
  links: readonly HunkLink[],
  preferred: ReadonlyMap<string, number>,
  linesOf: (hunk: string) => number,
): string[][] => {
  const hunks = [...preferred.keys()];
  const next = hunks.map(() => [] as number[]);

  for (const [lower, upper] of boundsOf(
    links,
    new Map(hunks.map((hunk, at) => [hunk, at])),
  )) {
    next[lower]?.push(upper);
  }

  const reached = hunks.map((_, at) => reachedOver(next, at));
  const parts: number[][] = [];
  const partOf = new Map<number, number>();

  for (const at of hunks.keys()) {
    if (!partOf.has(at)) {
      const part = [...(reached[at] ?? [])].filter((each) =>
        reached[each]?.has(at),
      );
      part.forEach((each) => partOf.set(each, parts.length));
      parts.push(part);
    }
  }

  const needs = parts.map(() => new Set<number>());

  for (const [lower, upper] of next.flatMap((uppers, lower) =>
    uppers.map((upper) => [lower, upper] as const),
  )) {
    const [from, to] = [partOf.get(lower), partOf.get(upper)];

    if (from !== undefined && to !== undefined && from !== to) {
      needs[to]?.add(from);
    }
  }

  const rank = (part: number) =>
    Math.min(
      ...(parts[part] ?? []).map((at) => preferred.get(hunks[at] ?? '') ?? 0),
    );
  const linesIn = (part: number) =>
    (parts[part] ?? []).reduce(
      (total, at) => total + Math.max(1, linesOf(hunks[at] ?? '')),
      0,
    );
  const placed = new Set<number>();
  const chunks: { hunks: string[]; lines: number }[] = [];

  while (placed.size < parts.length) {
    const ready = parts
      .map((_, part) => part)
      .filter(
        (part) =>
          !placed.has(part) &&
          [...(needs[part] ?? [])].every((each) => placed.has(each)),
      )
      .sort((a, b) => rank(a) - rank(b) || a - b)[0];

    if (ready === undefined) {
      return [hunks];
    }
    placed.add(ready);

    const last = chunks[chunks.length - 1];
    const lines = linesIn(ready);
    const members = (parts[ready] ?? []).flatMap((at) => hunks[at] ?? []);

    if (last && last.lines + lines <= LAYER_LINES) {
      last.hunks.push(...members);
      last.lines += lines;
    } else {
      chunks.push({ hunks: members, lines });
    }
  }

  return chunks.map((chunk) => chunk.hunks);
};

const refined = (
  links: readonly HunkLink[],
  preferred: ReadonlyMap<string, number>,
  linesOf: (hunk: string) => number,
): string[][] => {
  const levels = fitted(links, preferred, linesOf);
  const count = Math.max(-1, ...levels.values()) + 1;
  const groups = Array.from({ length: count }, (_, level) =>
    [...preferred.keys()].filter((hunk) => levels.get(hunk) === level),
  ).filter((group) => group.length > 0);

  return groups.flatMap((group) => {
    const inside = new Map(
      group.map((hunk) => [hunk, preferred.get(hunk) ?? 0]),
    );

    if (groups.length > 1 && new Set(inside.values()).size > 1) {
      return refined(links, inside, linesOf);
    }

    return packed(links, inside, linesOf);
  });
};

const PINNING_ROUNDS = 8;

const pinsOf = (
  links: readonly HunkLink[],
  bound: readonly HunkLink[],
  level: ReadonlyMap<string, number>,
): HunkLink[] => {
  const hunks = [...level.keys()];
  const indexOf = new Map(hunks.map((hunk, at) => [hunk, at]));
  const next = hunks.map(() => [] as number[]);

  for (const [lower, upper] of boundsOf(bound, indexOf)) {
    next[lower]?.push(upper);
  }

  const covering = new Map<string, HunkLink[]>();

  for (const link of links.filter((each) => each.kind === 'tests')) {
    if (level.has(link.from) && level.has(link.to)) {
      covering.set(link.from, [...(covering.get(link.from) ?? []), link]);
    }
  }

  return [...covering.values()].flatMap((covered) => {
    const latest = Math.max(...covered.map((link) => level.get(link.to) ?? 0));
    const last = covered.filter((link) => level.get(link.to) === latest);
    const lastOf = (link: HunkLink) => {
      const reached = reachedOver(next, indexOf.get(link.to) ?? 0);
      return last.every(
        (other) =>
          other.to === link.to || !reached.has(indexOf.get(other.to) ?? -1),
      );
    };
    const pinned = last.find(lastOf) ?? last[0];

    return pinned && level.get(pinned.from) !== latest
      ? [{ ...pinned, kind: 'moves' as const }]
      : [];
  });
};

export const nearestLevels = (
  links: readonly HunkLink[],
  layers: ReadonlyMap<string, number>,
  linesOf: (hunk: string) => number,
): Map<string, number> => {
  let bound = links;
  let level = new Map<string, number>();

  for (let round = 0; round < PINNING_ROUNDS; round++) {
    level = new Map(
      refined(bound, layers, linesOf).flatMap((group, at) =>
        group.map((hunk) => [hunk, at] as const),
      ),
    );

    const pins = pinsOf(links, bound, level);

    if (pins.length === 0) {
      break;
    }
    bound = [...bound, ...pins];
  }

  return level;
};
