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

export const FILE_CLASSES = [
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

export const LINK_KINDS = ['uses', 'tests', 'moves'] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

export interface HunkFacts {
  readonly hunk: string;
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
  readonly from: string;
  readonly to: string;
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

export interface CodeReading {
  classOf(path: string): FileClass;

  reads(path: string): boolean;

  definitionsIn(path: string, added: readonly string[]): readonly string[];

  importsIn(path: string, added: readonly string[]): readonly string[];
}

const MOST_DEFINERS = 3;

const LEAST_MOVED_LINES = 3;

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

const movedBetween = (from: DiffHunk, to: DiffHunk): boolean => {
  const removed = linesOf(from, '-').filter((line) => line.trim());
  const block = squeezed(removed);

  return (
    removed.length >= LEAST_MOVED_LINES &&
    block.length > 0 &&
    squeezed(linesOf(to, '+')).includes(block)
  );
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

  const moves: HunkLink[] = entries.flatMap((source) =>
    entries
      .filter(
        (target) =>
          target.hunk.id !== source.hunk.id &&
          movedBetween(source.hunk, target.hunk),
      )
      .map((target) => ({
        kind: 'moves' as const,
        from: target.hunk.id,
        to: source.hunk.id,
        because: [`${source.file.path} → ${target.file.path}`],
      })),
  );

  const movedHunks = new Set(moves.flatMap(({ from, to }) => [from, to]));

  const hunks: HunkFacts[] = entries.map(({ file, hunk }) => {
    const fileClass = reading.classOf(file.path);
    const renamed = file.status === 'renamed' && hunk.patch === '';
    const incidental =
      fileClass === 'lockfile' ||
      fileClass === 'generated' ||
      fileClass === 'snapshot' ||
      renamed ||
      (hunk.patch !== '' && formattingOnly(hunk));

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
  const definers = new Map<string, string[]>();

  for (const each of hunks) {
    for (const symbol of each.defines.filter((name) => !/\s/.test(name))) {
      definers.set(symbol, [...(definers.get(symbol) ?? []), each.hunk]);
    }
  }

  const linked = new Map<
    string,
    { kind: LinkKind; from: string; to: string; because: Set<string> }
  >();

  const link = (kind: LinkKind, from: string, to: string, because: string) => {
    const key = `${kind}:${from}>${to}`;
    const held = linked.get(key) ?? {
      kind,
      from,
      to,
      because: new Set<string>(),
    };

    held.because.add(because);
    linked.set(key, held);
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

      if (where.length > MOST_DEFINERS) {
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

  for (const { from, to, because } of indexed.links) {
    if (!known.get(from)?.incidental && !known.get(to)?.incidental) {
      link('uses', from, to, because);
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
