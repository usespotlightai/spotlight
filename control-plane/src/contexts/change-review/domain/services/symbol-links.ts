import type {
  IndexedFile,
  IndexedImport,
  IndexedSymbol,
  SourceSide,
  SymbolIndex,
} from '@change-review/domain/services/symbol-index';
import {
  changedLinesOf,
  type Diff,
} from '@change-review/domain/value-objects/diff.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

export interface SymbolLink {
  readonly from: HunkId;
  readonly to: HunkId;
  readonly because: string;
}

export interface IndexedFacts {
  readonly covered: ReadonlySet<HunkId>;
  readonly defines: ReadonlyMap<HunkId, readonly string[]>;
  readonly outside: ReadonlyMap<HunkId, readonly string[]>;
  readonly links: readonly SymbolLink[];
  readonly tests: readonly SymbolLink[];
}

const MOST_MEMBER_DEFINERS = 3;

const LEAST_MEMBER_NAME = 4;

const MOST_OUTSIDE = 6;

const WILDCARD = /^(:\w+|\{[^}]*\}|<[^>]*>|\*)$/;

const segmentsOf = (path: string): string[] =>
  path
    .replace(/^\w+:\/\/[^/]+/, '')
    .split(/[?#]/)[0]
    ?.split('/')
    .filter(Boolean) ?? [];

const routePathOf = (route: string): string => route.replace(/^\S+\s+/, '');

const routeMatches = (route: string, used: string): boolean => {
  const wanted = segmentsOf(routePathOf(route));
  const given = segmentsOf(used);
  const offset = given.length - wanted.length;

  return (
    wanted.filter((segment) => !WILDCARD.test(segment)).length >= 2 &&
    offset >= 0 &&
    wanted.every((segment, at) => {
      const other = given[offset + at] ?? '';
      return (
        WILDCARD.test(segment) || WILDCARD.test(other) || segment === other
      );
    })
  );
};

const exposes = (symbol: IndexedSymbol, name: string): boolean =>
  name === 'default'
    ? symbol.exportedAs.includes('default')
    : symbol.exportedAs.includes(name) ||
      (symbol.exportedAs.length === 0 && symbol.name === name);

export const indexedFacts = (
  diff: Diff,
  index: SymbolIndex,
  testing: (path: string) => boolean = () => false,
): IndexedFacts => {
  const changed = new Map<string, HunkId>();
  const touched = new Map<string, { hunk: HunkId; lines: number[] }[]>();
  const covered = new Set<HunkId>();
  const indexedPaths = new Set(
    index.files.map((file) => `${file.side}:${file.path}`),
  );

  for (const file of diff.files) {
    for (const hunk of file.hunks) {
      const lines = changedLinesOf(hunk);
      const before = file.previousPath ?? file.path;

      touched.set(file.path, [
        ...(touched.get(file.path) ?? []),
        {
          hunk: hunk.id,
          lines: lines.added.length > 0 ? lines.added : [hunk.newStart],
        },
      ]);
      const sides: [SourceSide, string, number[]][] = [
        ['after', file.path, lines.added],
        ['before', before, lines.removed],
      ];

      for (const [side, path, numbers] of sides) {
        if (indexedPaths.has(`${side}:${path}`)) {
          covered.add(hunk.id);
        }
        for (const line of numbers) {
          changed.set(`${side}:${path}:${line}`, hunk.id);
        }
      }
    }
  }

  const hunkAt = (file: IndexedFile, line: number): HunkId | null =>
    changed.get(`${file.side}:${file.path}:${line}`) ?? null;

  const files = new Map(
    index.files.map((file) => [`${file.side}:${file.path}`, file]),
  );
  const fileAt = (side: SourceSide, path: string) =>
    files.get(`${side}:${path}`) ?? null;

  const defines = new Map<HunkId, Set<string>>();
  const outside = new Map<HunkId, Set<string>>();
  const links = new Map<string, SymbolLink>();
  const tests = new Map<string, SymbolLink>();
  const methods = new Map<
    string,
    { file: IndexedFile; symbol: IndexedSymbol; hunk: HunkId }[]
  >();

  for (const file of index.files) {
    for (const symbol of file.symbols) {
      const hunk = hunkAt(file, symbol.line);

      if (!hunk) {
        continue;
      }

      defines.set(hunk, (defines.get(hunk) ?? new Set()).add(symbol.name));

      if (symbol.kind === 'method') {
        const key = `${file.side}:${symbol.name}`;
        methods.set(key, [...(methods.get(key) ?? []), { file, symbol, hunk }]);
      }
    }
  }

  const link = (
    file: IndexedFile,
    user: HunkId,
    target: IndexedFile,
    symbol: IndexedSymbol,
  ) => {
    const definer = hunkAt(target, symbol.line);

    if (!definer || definer === user) {
      return;
    }

    const [from, to, because] =
      file.side === 'after'
        ? [user, definer, symbol.name]
        : [definer, user, `${symbol.name} (removed)`];

    links.set(`${from}>${to}:${because}`, { from, to, because });
  };

  const cover = (
    file: IndexedFile,
    user: HunkId,
    target: IndexedFile,
    symbol: IndexedSymbol,
  ) => {
    if (
      file.side !== 'after' ||
      target.side !== 'after' ||
      !testing(file.path) ||
      testing(target.path)
    ) {
      return;
    }

    const because = target.path.split('/').pop() ?? target.path;

    for (const { hunk, lines } of touched.get(target.path) ?? []) {
      if (
        hunk !== user &&
        lines.some((line) => line >= symbol.line && line <= symbol.endLine)
      ) {
        tests.set(`${user}>${hunk}`, { from: user, to: hunk, because });
      }
    }
  };

  const linkImported = (
    file: IndexedFile,
    user: HunkId,
    imported: IndexedImport,
    name: string,
  ) => {
    for (const path of imported.resolved) {
      const target = fileAt(file.side, path);

      for (const symbol of target?.symbols ?? []) {
        if (target && symbol.kind !== 'route' && exposes(symbol, name)) {
          link(file, user, target, symbol);
          cover(file, user, target, symbol);
        }
      }
    }
  };

  const note = (user: HunkId, imported: IndexedImport, name: string) => {
    if (!imported.project || imported.resolved.length > 0) {
      return;
    }

    const notes = outside.get(user) ?? new Set<string>();

    if (notes.size < MOST_OUTSIDE) {
      notes.add(`${name} from ${imported.specifier}`);
    }
    outside.set(user, notes);
  };

  const routes = index.files
    .filter((file) => file.side === 'after')
    .flatMap((file) =>
      file.symbols
        .filter((symbol) => symbol.kind === 'route')
        .map((symbol) => ({ file, symbol })),
    );

  for (const file of index.files) {
    const byLocal = new Map(file.imports.map((each) => [each.local, each]));

    for (const reference of file.references) {
      const user = hunkAt(file, reference.line);

      if (!user) {
        continue;
      }

      if (reference.through === null) {
        const imported = byLocal.get(reference.name);

        if (imported) {
          linkImported(
            file,
            user,
            imported,
            imported.imported === '*' ? reference.name : imported.imported,
          );
          note(user, imported, reference.name);
          continue;
        }

        for (const path of file.scope) {
          const target = fileAt(file.side, path);

          for (const symbol of target?.symbols ?? []) {
            if (
              target &&
              symbol.name === reference.name &&
              symbol.kind !== 'route' &&
              symbol.kind !== 'method'
            ) {
              link(file, user, target, symbol);
            }
          }
        }
        continue;
      }

      const through = byLocal.get(reference.through);

      if (through) {
        linkImported(file, user, through, reference.name);
        note(user, through, `${reference.through}.${reference.name}`);
        continue;
      }

      const candidates = methods.get(`${file.side}:${reference.name}`) ?? [];
      const definers = new Set(candidates.map((each) => each.hunk));

      if (
        reference.name.length < LEAST_MEMBER_NAME ||
        definers.size === 0 ||
        definers.size > MOST_MEMBER_DEFINERS
      ) {
        continue;
      }

      for (const candidate of candidates) {
        link(file, user, candidate.file, candidate.symbol);
      }
    }

    if (file.side !== 'after') {
      continue;
    }

    for (const used of file.routeUses) {
      const user = hunkAt(file, used.line);

      if (!user) {
        continue;
      }

      for (const route of routes) {
        if (routeMatches(route.symbol.name, used.path)) {
          link(file, user, route.file, route.symbol);
        }
      }
    }
  }

  const listed = (map: Map<HunkId, Set<string>>) =>
    new Map([...map.entries()].map(([hunk, names]) => [hunk, [...names]]));

  return {
    covered,
    defines: listed(defines),
    outside: listed(outside),
    links: [...links.values()],
    tests: [...tests.values()],
  };
};
