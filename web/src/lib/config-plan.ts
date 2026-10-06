import {
  CHANGED_WITHIN,
  type ConfigChange,
  shownValue,
} from '@/lib/station-config';

export type PlanMark = ConfigChange['kind'];

export type PlanLeaf = {
  readonly id: string;
  readonly mark: PlanMark;
  readonly name: string | null;
  readonly was: string | null;
  readonly now: string | null;
  readonly note: string | null;
};

export type PlanTextLine =
  | { readonly mark: 'added' | 'removed' | null; readonly text: string }
  | { readonly hidden: number };

export type PlanEntry =
  | ({ readonly kind: 'leaf' } & PlanLeaf)
  | {
      readonly kind: 'group';
      readonly id: string;
      readonly name: string;
      readonly list: boolean;
      readonly leaves: readonly PlanLeaf[];
    }
  | {
      readonly kind: 'text';
      readonly id: string;
      readonly mark: PlanMark;
      readonly name: string;
      readonly lines: readonly PlanTextLine[];
    };

const LISTS: Partial<Record<ConfigChange['part'], string>> = {
  skill: 'skills',
  tool: 'tools',
};

const MOST_INLINE = 48;

const CONTEXT = 2;

const inline = (value: string | null): boolean =>
  value === null || (value.length <= MOST_INLINE && !value.includes('\n'));

const quoted = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  return value !== '' && !Number.isNaN(Number(value))
    ? value
    : JSON.stringify(value);
};

const idOf = (change: ConfigChange): string =>
  `${change.part}:${change.name ?? ''}`;

type Step = {
  readonly mark: 'added' | 'removed' | null;
  readonly text: string;
};

const steps = (was: readonly string[], now: readonly string[]): Step[] => {
  const shared = Array.from({ length: was.length + 1 }, () =>
    new Array<number>(now.length + 1).fill(0),
  );

  for (let a = was.length - 1; a >= 0; a -= 1) {
    for (let b = now.length - 1; b >= 0; b -= 1) {
      shared[a][b] =
        was[a] === now[b]
          ? shared[a + 1][b + 1] + 1
          : Math.max(shared[a + 1][b], shared[a][b + 1]);
    }
  }

  const out: Step[] = [];
  let a = 0;
  let b = 0;

  while (a < was.length || b < now.length) {
    if (a < was.length && b < now.length && was[a] === now[b]) {
      out.push({ mark: null, text: was[a] });
      a += 1;
      b += 1;
    } else if (
      a < was.length &&
      (b === now.length || shared[a + 1][b] >= shared[a][b + 1])
    ) {
      out.push({ mark: 'removed', text: was[a] });
      a += 1;
    } else {
      out.push({ mark: 'added', text: now[b] });
      b += 1;
    }
  }

  return out;
};

const linesOf = (value: string | null): string[] =>
  value === null ? [] : value.replace(/\n$/, '').split('\n');

export const planTextLines = (
  was: string | null,
  now: string | null,
): PlanTextLine[] => {
  const all = steps(linesOf(was), linesOf(now));
  const near = all.map((_, at) =>
    all
      .slice(Math.max(0, at - CONTEXT), at + CONTEXT + 1)
      .some((each) => each.mark !== null),
  );
  const out: PlanTextLine[] = [];
  let hidden = 0;

  all.forEach((step, at) => {
    if (near[at]) {
      if (hidden > 0) {
        out.push({ hidden });
        hidden = 0;
      }
      out.push(step);
    } else {
      hidden += 1;
    }
  });

  return hidden > 0 ? [...out, { hidden }] : out;
};

const leafOf = (change: ConfigChange): PlanLeaf => {
  const was = quoted(shownValue(change.part, change.was));
  const now = quoted(shownValue(change.part, change.now));
  const base = { id: idOf(change), mark: change.kind };

  if (change.part === 'repository' && change.name) {
    return {
      ...base,
      name: `repository ${JSON.stringify(change.name)}`,
      was: null,
      now: null,
      note: change.kind === 'changed' ? 'setup changed' : null,
    };
  }

  if (change.part === 'profile' && change.name) {
    return {
      ...base,
      name: 'profile',
      was: null,
      now: JSON.stringify(change.name),
      note: change.kind === 'changed' ? (CHANGED_WITHIN.profile ?? null) : null,
    };
  }

  return {
    ...base,
    name: change.name ?? change.part,
    was: change.kind === 'added' ? null : was,
    now: change.kind === 'removed' ? null : now,
    note: change.kind === 'changed' && !(was && now) ? 'changed' : null,
  };
};

const itemOf = (change: ConfigChange): PlanLeaf => ({
  id: idOf(change),
  mark: change.kind,
  name: null,
  was: null,
  now: `${JSON.stringify(change.name ?? change.now ?? change.was ?? '')},`,
  note: change.kind === 'changed' ? 'changed' : null,
});

const textOf = (change: ConfigChange): PlanEntry => ({
  kind: 'text',
  id: idOf(change),
  mark: change.kind,
  name: change.name ?? change.part,
  lines: planTextLines(change.was, change.now),
});

export const configPlan = (changes: readonly ConfigChange[]): PlanEntry[] => {
  const out: PlanEntry[] = [];
  const grouped = new Set<string>();

  for (const change of changes) {
    const list = LISTS[change.part];
    const within =
      list ?? (change.part === 'judge' && change.name ? 'judge' : null);

    if (within) {
      if (!grouped.has(within)) {
        grouped.add(within);
        out.push({
          kind: 'group',
          id: within,
          name: within,
          list: Boolean(list),
          leaves: changes
            .filter((each) =>
              list
                ? each.part === change.part
                : each.part === 'judge' && each.name,
            )
            .map(list ? itemOf : leafOf),
        });
      }
    } else if (!inline(change.was) || !inline(change.now)) {
      out.push(textOf(change));
    } else {
      out.push({ kind: 'leaf', ...leafOf(change) });
    }
  }

  return out;
};

const assigned = (leaf: PlanLeaf): boolean =>
  leaf.name !== null && (leaf.was !== null || leaf.now !== null);

export const planNameWidth = (entries: readonly PlanEntry[]): number =>
  Math.max(
    0,
    ...entries.map((entry) => {
      if (entry.kind === 'leaf') {
        return assigned(entry) ? (entry.name?.length ?? 0) : 0;
      }

      return entry.kind === 'group' && !entry.list ? 0 : entry.name.length;
    }),
  );

export const leafNameWidth = (leaves: readonly PlanLeaf[]): number =>
  Math.max(
    0,
    ...leaves.map((leaf) => (assigned(leaf) ? (leaf.name?.length ?? 0) : 0)),
  );

export const leafAssigned = assigned;
