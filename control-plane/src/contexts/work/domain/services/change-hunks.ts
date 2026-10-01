export interface ChangeHunk {
  readonly id: string;
  readonly path: string;
  readonly index: number;
  readonly header: string;
  readonly lines: readonly string[];
}

interface Edit {
  readonly sign: ' ' | '-' | '+';
  readonly text: string;
  readonly old: number;
  readonly now: number;
}

const CONTEXT = 3;

const MOST_COMPARED = 1_000_000;

const linesOf = (text: string): string[] => {
  if (text === '') {
    return [];
  }

  const lines = text.split('\n');
  return text.endsWith('\n') ? lines.slice(0, -1) : lines;
};

const sharedLengths = (
  before: readonly string[],
  after: readonly string[],
): Uint32Array[] => {
  const lengths = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  );

  for (let old = before.length - 1; old >= 0; old -= 1) {
    const row = lengths[old] as Uint32Array;
    const below = lengths[old + 1] as Uint32Array;

    for (let now = after.length - 1; now >= 0; now -= 1) {
      row[now] =
        before[old] === after[now]
          ? (below[now + 1] as number) + 1
          : Math.max(below[now] as number, row[now + 1] as number);
    }
  }

  return lengths;
};

const middleEdits = (
  before: readonly string[],
  after: readonly string[],
  from: number,
): Edit[] => {
  const edits: Edit[] = [];
  const lengths =
    before.length * after.length <= MOST_COMPARED
      ? sharedLengths(before, after)
      : null;
  let old = 0;
  let now = 0;

  const push = (sign: Edit['sign'], text: string) =>
    edits.push({ sign, text, old: from + old, now: from + now });

  while (old < before.length || now < after.length) {
    const kept = before[old];
    const added = after[now];

    if (
      lengths &&
      kept !== undefined &&
      added !== undefined &&
      kept === added
    ) {
      push(' ', kept);
      old += 1;
      now += 1;
    } else if (
      kept !== undefined &&
      (added === undefined ||
        !lengths ||
        (lengths[old + 1]?.[now] ?? 0) >= (lengths[old]?.[now + 1] ?? 0))
    ) {
      push('-', kept);
      old += 1;
    } else {
      push('+', added as string);
      now += 1;
    }
  }

  return edits;
};

const editsOf = (before: string, after: string): Edit[] => {
  const old = linesOf(before);
  const now = linesOf(after);
  let head = 0;

  while (head < old.length && head < now.length && old[head] === now[head]) {
    head += 1;
  }

  let tail = 0;

  while (
    tail < old.length - head &&
    tail < now.length - head &&
    old[old.length - 1 - tail] === now[now.length - 1 - tail]
  ) {
    tail += 1;
  }

  const same = (from: number, to: number, shift: number): Edit[] =>
    old.slice(from, to).map((text, at) => ({
      sign: ' ',
      text,
      old: from + at,
      now: from + at + shift,
    }));

  return [
    ...same(0, head, 0),
    ...middleEdits(
      old.slice(head, old.length - tail),
      now.slice(head, now.length - tail),
      head,
    ),
    ...same(old.length - tail, old.length, now.length - old.length),
  ];
};

const span = (start: number, count: number): string =>
  count === 1 ? `${start}` : `${start},${count}`;

const headerOf = (edits: readonly Edit[]): string => {
  const olds = edits.filter((each) => each.sign !== '+');
  const nows = edits.filter((each) => each.sign !== '-');
  const first = edits[0] as Edit;
  const oldStart = olds.length > 0 ? (olds[0] as Edit).old + 1 : first.old;
  const newStart = nows.length > 0 ? (nows[0] as Edit).now + 1 : first.now;

  return `@@ -${span(oldStart, olds.length)} +${span(newStart, nows.length)} @@`;
};

const hunkId = (path: string, index: number): string => `${path}#${index}`;

export const hunksOf = (
  path: string,
  before: string,
  after: string,
): ChangeHunk[] => {
  const edits = editsOf(before, after);
  const changed = edits.flatMap((each, at) => (each.sign === ' ' ? [] : [at]));
  const groups: { from: number; to: number }[] = [];

  for (const at of changed) {
    const from = Math.max(0, at - CONTEXT);
    const to = Math.min(edits.length, at + CONTEXT + 1);
    const last = groups[groups.length - 1];

    if (last && from <= last.to) {
      last.to = Math.max(last.to, to);
    } else {
      groups.push({ from, to });
    }
  }

  return groups.map((group, at) => {
    const within = edits.slice(group.from, group.to);
    const index = at + 1;

    return {
      id: hunkId(path, index),
      path,
      index,
      header: headerOf(within),
      lines: within.map((each) => `${each.sign}${each.text}`),
    };
  });
};

interface FileChange {
  readonly path: string | null;
  readonly before: string;
  readonly after: string;
}

const netPerPath = (changes: readonly FileChange[]): readonly FileChange[] => {
  const net = new Map<string, FileChange>();
  const unnamed: FileChange[] = [];

  for (const change of changes) {
    if (change.path === null) {
      unnamed.push(change);
      continue;
    }

    const first = net.get(change.path);
    net.set(change.path, first ? { ...first, after: change.after } : change);
  }

  return [...net.values(), ...unnamed];
};

export const changedLinesOf = (changes: readonly FileChange[]): number =>
  netPerPath(changes).reduce(
    (sum, change) =>
      sum +
      editsOf(change.before, change.after).filter((each) => each.sign !== ' ')
        .length,
    0,
  );
