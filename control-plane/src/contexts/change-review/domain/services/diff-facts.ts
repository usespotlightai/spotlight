import {
  NO_INDEX,
  type SymbolIndex,
} from '@change-review/domain/services/symbol-index';
import { indexedFacts } from '@change-review/domain/services/symbol-links';
import type {
  Diff,
  DiffFile,
  DiffHunk,
} from '@change-review/domain/value-objects/diff.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

const FILE_CLASSES = [
  'lockfile',
  'generated',
  'snapshot',
  'migration',
  'config',
  'test',
  'docs',
  'source',
] as const;

export type FileClass = (typeof FILE_CLASSES)[number];

const LINK_KINDS = ['uses', 'removes', 'tests', 'moves'] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

export interface HunkFacts {
  readonly hunk: HunkId;
  readonly path: string;
  readonly fileClass: FileClass;
  readonly incidental: boolean;
  readonly renamed: boolean;
  readonly moved: boolean;
  readonly linkable: boolean;
  readonly defines: readonly string[];
  readonly outside: readonly string[];
}

export interface HunkLink {
  readonly kind: LinkKind;
  readonly from: HunkId;
  readonly to: HunkId;
  readonly because: readonly string[];
}

export interface FileImport {
  readonly from: string;
  readonly to: string;
}

export interface DiffFacts {
  readonly hunks: readonly HunkFacts[];
  readonly links: readonly HunkLink[];
  readonly imports: readonly FileImport[];
}

export const NO_FACTS: DiffFacts = { hunks: [], links: [], imports: [] };

export const linkFact = ({ kind, to, because }: HunkLink): string => {
  const symbols = because.join(', ');

  switch (kind) {
    case 'uses':
      return `uses ${symbols} from ${to}`;
    case 'removes':
      return `removes ${symbols}, which ${to} stops using`;
    case 'tests':
      return `tests ${symbols} in ${to}`;
    case 'moves':
      return `moves code from ${to}`;
  }
};

export const connectedGroups = (
  hunks: readonly HunkId[],
  links: readonly HunkLink[],
): HunkId[][] => {
  const parent = new Map<HunkId, HunkId>(hunks.map((hunk) => [hunk, hunk]));
  const size = new Map<HunkId, number>(hunks.map((hunk) => [hunk, 1]));
  const root = (hunk: HunkId): HunkId => {
    let top = hunk;

    while (parent.get(top) !== top) {
      top = parent.get(top) ?? top;
    }
    for (let at = hunk; at !== top; ) {
      const next = parent.get(at) ?? top;
      parent.set(at, top);
      at = next;
    }
    return top;
  };

  for (const { from, to } of links) {
    if (parent.has(from) && parent.has(to)) {
      const [a, b] = [root(from), root(to)];

      if (a !== b) {
        const [small, large] =
          (size.get(a) ?? 1) < (size.get(b) ?? 1) ? [a, b] : [b, a];
        parent.set(small, large);
        size.set(large, (size.get(large) ?? 1) + (size.get(small) ?? 1));
      }
    }
  }

  const groups = new Map<HunkId, HunkId[]>();

  for (const hunk of hunks) {
    const top = root(hunk);
    const group = groups.get(top);

    if (group) {
      group.push(hunk);
    } else {
      groups.set(top, [hunk]);
    }
  }

  return [...groups.values()];
};

export const placedHunks = (facts: DiffFacts): HunkId[] =>
  facts.hunks.filter((each) => !each.incidental).map((each) => each.hunk);

export interface CodeReading {
  classOf(path: string): FileClass;

  reads(path: string): boolean;

  definitionsIn(path: string, added: readonly string[]): readonly string[];

  importsIn(path: string, added: readonly string[]): readonly string[];
}

const MAX_DEFINERS = 3;

const MIN_MOVED_LINES = 3;

const IDENTIFIER = /[A-Za-z_$][\w$]*/g;

const linesOf = (hunk: DiffHunk, sign: '+' | '-'): string[] =>
  hunk.patch
    .split('\n')
    .slice(1)
    .filter((line) => line.startsWith(sign))
    .map((line) => line.slice(1));

const squeezed = (lines: readonly string[]): string =>
  lines.join('').replace(/\s+/g, '');

const formattingOnly = (hunk: DiffHunk): boolean => {
  const added = linesOf(hunk, '+');
  const removed = linesOf(hunk, '-');

  return (
    added.length + removed.length > 0 && squeezed(added) === squeezed(removed)
  );
};

const stemOf = (path: string): string =>
  (path.split('/').pop() ?? path)
    .replace(/^test_/, '')
    .replace(/(_test|\.test|\.spec)?\.[^.]+$/, '');

const importedStems = (
  reading: CodeReading,
  file: DiffFile,
  hunk: DiffHunk,
): string[] =>
  reading
    .importsIn(file.path, linesOf(hunk, '+'))
    .map(
      (specifier) => specifier.split(/[/.]/).filter(Boolean).pop() ?? specifier,
    );

const movedBlockOf = (hunk: DiffHunk): string | null => {
  const removed = linesOf(hunk, '-').filter((line) => line.trim());
  const block = squeezed(removed);

  return removed.length >= MIN_MOVED_LINES && block.length > 0 ? block : null;
};

export const factsOf = (
  diff: Diff,
  reading: CodeReading,
  index: SymbolIndex = NO_INDEX,
): DiffFacts => {
  const indexed = indexedFacts(
    diff,
    index,
    (path) => reading.classOf(path) === 'test',
  );
  const entries = diff.files.flatMap((file) =>
    file.hunks.map((hunk) => ({ file, hunk })),
  );

  const incidentalHunks = new Set(
    entries
      .filter(({ file, hunk }) => {
        const fileClass = reading.classOf(file.path);

        return (
          fileClass === 'lockfile' ||
          fileClass === 'generated' ||
          fileClass === 'snapshot' ||
          (file.status === 'renamed' && hunk.patch === '') ||
          (hunk.patch !== '' && formattingOnly(hunk))
        );
      })
      .map(({ hunk }) => hunk.id),
  );
  const substantive = entries.filter(
    ({ hunk }) => !incidentalHunks.has(hunk.id),
  );

  const additions = substantive.map((each) => ({
    ...each,
    text: squeezed(linesOf(each.hunk, '+')),
  }));
  const moves: HunkLink[] = substantive.flatMap((source) => {
    const block = movedBlockOf(source.hunk);

    return block === null
      ? []
      : additions
          .filter(
            (target) =>
              target.hunk.id !== source.hunk.id &&
              target.text.length >= block.length &&
              target.text.includes(block),
          )
          .map((target) => ({
            kind: 'moves' as const,
            from: target.hunk.id,
            to: source.hunk.id,
            because: [`${source.file.path} → ${target.file.path}`],
          }));
  });

  const movedHunks = new Set(moves.flatMap(({ from, to }) => [from, to]));

  const hunks: HunkFacts[] = entries.map(({ file, hunk }) => {
    const fileClass = reading.classOf(file.path);
    const renamed = file.status === 'renamed' && hunk.patch === '';
    const incidental = incidentalHunks.has(hunk.id);

    return {
      hunk: hunk.id,
      path: file.path,
      fileClass,
      incidental,
      renamed,
      moved: movedHunks.has(hunk.id),
      linkable:
        !incidental &&
        (indexed.covered.has(hunk.id) || reading.reads(file.path)),
      defines: incidental
        ? []
        : indexed.covered.has(hunk.id)
          ? (indexed.defines.get(hunk.id) ?? [])
          : [...reading.definitionsIn(file.path, linesOf(hunk, '+'))],
      outside: incidental ? [] : (indexed.outside.get(hunk.id) ?? []),
    };
  });

  const known = new Map(hunks.map((each) => [each.hunk, each]));
  const definers = new Map<string, HunkId[]>();

  for (const each of hunks) {
    for (const symbol of each.defines.filter((name) => !/\s/.test(name))) {
      definers.set(symbol, [...(definers.get(symbol) ?? []), each.hunk]);
    }
  }

  const linked = new Map<
    string,
    { kind: LinkKind; from: HunkId; to: HunkId; because: Set<string> }
  >();

  const link = (kind: LinkKind, from: HunkId, to: HunkId, because: string) => {
    const key = `${kind}:${from}>${to}`;
    const entry = linked.get(key) ?? {
      kind,
      from,
      to,
      because: new Set<string>(),
    };

    entry.because.add(because);
    linked.set(key, entry);
  };

  for (const { file, hunk } of entries) {
    const facts = known.get(hunk.id);

    if (!facts || facts.incidental) {
      continue;
    }

    const used = new Set(
      indexed.covered.has(hunk.id)
        ? []
        : linesOf(hunk, '+').flatMap((line) => line.match(IDENTIFIER) ?? []),
    );

    for (const symbol of used) {
      const where = definers.get(symbol) ?? [];

      if (where.length > MAX_DEFINERS) {
        continue;
      }

      for (const definer of where) {
        if (definer !== hunk.id) {
          link('uses', hunk.id, definer, symbol);
        }
      }
    }

    if (facts.fileClass !== 'test') {
      continue;
    }

    const stems = new Set([
      stemOf(file.path),
      ...(indexed.covered.has(hunk.id)
        ? []
        : importedStems(reading, file, hunk)),
    ]);

    for (const source of hunks) {
      if (
        source.fileClass === 'source' &&
        !source.incidental &&
        stems.has(stemOf(source.path))
      ) {
        link(
          'tests',
          hunk.id,
          source.hunk,
          source.path.split('/').pop() ?? source.path,
        );
      }
    }
  }

  for (const { from, to, because } of indexed.tests) {
    const source = known.get(to);

    if (
      !known.get(from)?.incidental &&
      source?.fileClass === 'source' &&
      !source.incidental
    ) {
      link('tests', from, to, because);
    }
  }

  for (const { kind, from, to, because } of indexed.links) {
    if (!known.get(from)?.incidental && !known.get(to)?.incidental) {
      link(kind, from, to, because);
    }
  }

  return {
    hunks,
    imports: index.files
      .filter((file) => file.side === 'after')
      .flatMap((file) =>
        file.imports.flatMap((each) =>
          each.resolved.map((to) => ({ from: file.path, to })),
        ),
      ),
    links: [
      ...[...linked.values()].map(({ kind, from, to, because }) => ({
        kind,
        from,
        to,
        because: [...because].sort(),
      })),
      ...moves,
    ],
  };
};
