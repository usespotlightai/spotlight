import ts from 'typescript';
import { AGGREGATE_TABLE_NAMES } from './aggregate-versions';
import {
  SNAPSHOT_FOREIGN_KEYS,
  SNAPSHOT_VERSIONED_TABLES,
} from './drizzle-snapshot';
import { tableBindingsOf } from './drizzle-tables';
import type { Violation } from './known-violations';
import {
  descendants,
  moduleSpecifiersOf,
  moduleTarget,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';

export const STANDALONE_TABLES: ReadonlySet<string> = new Set([
  'memory_use',
  'oidc_trust_usage',
  'secret_value',
  'signup_survey',
]);

const isAggregateTable = (name: string): boolean =>
  SNAPSHOT_VERSIONED_TABLES.has(name) || AGGREGATE_TABLE_NAMES.has(name);

const rootsOf = (table: string, seen = new Set<string>()): Set<string> => {
  if (seen.has(table)) {
    return new Set();
  }

  seen.add(table);

  return new Set(
    SNAPSHOT_FOREIGN_KEYS.filter((key) => key.tableFrom === table).flatMap(
      (key) =>
        isAggregateTable(key.tableTo)
          ? [key.tableTo]
          : [...rootsOf(key.tableTo, seen)],
    ),
  );
};

export const CHILD_TABLE_ROOTS: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map(
  [...new Set(SNAPSHOT_FOREIGN_KEYS.map((key) => key.tableFrom))]
    .filter(
      (table) => !isAggregateTable(table) && !STANDALONE_TABLES.has(table),
    )
    .map((table) => [table, rootsOf(table)] as const)
    .filter(([, roots]) => roots.size > 0),
);

const WRITE_METHODS: ReadonlySet<string> = new Set([
  'insert',
  'update',
  'delete',
]);

const TABLE_NAME = String.raw`(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?`;
const RAW_WRITE = new RegExp(
  String.raw`\b(?:update|delete\s+from|insert\s+into)\s+${TABLE_NAME}`,
  'gi',
);
const RAW_WRITE_BEFORE_TABLE = /\b(update|delete\s+from|insert\s+into)\s*"?$/i;

const builderWrites = (file: SourceFile): string[] => {
  const tables = tableBindingsOf(file);

  return descendants(file.tree, ts.isCallExpression).flatMap((call) => {
    const argument = call.arguments[0];

    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      !WRITE_METHODS.has(call.expression.name.text) ||
      !argument
    ) {
      return [];
    }

    const table = tables.get(argument.getText());

    return table ? [table.name] : [];
  });
};

const rawWrites = (file: SourceFile): string[] => {
  const tables = tableBindingsOf(file);

  return descendants(file.tree, ts.isTaggedTemplateExpression)
    .filter((tagged) => /^sql\b/.test(tagged.tag.getText()))
    .flatMap((tagged) => {
      const template = tagged.template;
      const texts = ts.isNoSubstitutionTemplateLiteral(template)
        ? [template.text]
        : [
            template.head.text,
            ...template.templateSpans.map((span) => span.literal.text),
          ];
      const named = [...texts.join(' ').matchAll(RAW_WRITE)].map(
        ([, name]) => name as string,
      );
      const interpolated = ts.isNoSubstitutionTemplateLiteral(template)
        ? []
        : template.templateSpans.flatMap((span, index) =>
            RAW_WRITE_BEFORE_TABLE.test(texts[index] as string)
              ? [tables.get(span.expression.getText())?.name ?? []].flat()
              : [],
          );

      return [...named, ...interpolated];
    });
};

export const tablesWrittenIn = (file: SourceFile): ReadonlySet<string> =>
  new Set([...builderWrites(file), ...rawWrites(file)]);

const childWritesOf = (
  file: SourceFile,
  rootWriter: (file: SourceFile, roots: ReadonlySet<string>) => boolean,
): Violation[] => {
  const written = tablesWrittenIn(file);

  return [...written].flatMap((table) => {
    const roots = CHILD_TABLE_ROOTS.get(table);

    if (!roots || rootWriter(file, roots)) {
      return [];
    }

    return [
      {
        key: `${file.path}: writes ${table} outside the repository of ${[...roots].sort().join(' or ')}`,
        at: file.path,
      },
    ];
  });
};

const writesARoot = (file: SourceFile, roots: ReadonlySet<string>): boolean => {
  const written = tablesWrittenIn(file);

  return [...roots].some((root) => written.has(root));
};

export const childWritesIn = (file: SourceFile): Violation[] =>
  childWritesOf(file, writesARoot);

export const aggregateChildWriteViolations = (): Violation[] => {
  const files = sourceFiles();
  const importersOf = (file: SourceFile): SourceFile[] =>
    files.filter((each) =>
      moduleSpecifiersOf(each).some(
        (specifier) =>
          moduleTarget(each.path, specifier) === withoutExtension(file.path),
      ),
    );
  const rootWriter = (
    file: SourceFile,
    roots: ReadonlySet<string>,
  ): boolean => {
    if (writesARoot(file, roots)) {
      return true;
    }

    const importers = importersOf(file);

    return (
      importers.length > 0 &&
      importers.every((importer) => writesARoot(importer, roots))
    );
  };

  return files.flatMap((file) => childWritesOf(file, rootWriter));
};
