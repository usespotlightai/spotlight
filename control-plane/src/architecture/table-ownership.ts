import ts from 'typescript';
import { SNAPSHOT_FOREIGN_KEYS } from './drizzle-snapshot';
import { DRIZZLE_TABLES, tableNamed } from './drizzle-tables';
import type { Violation } from './known-violations';
import {
  contextOf,
  descendants,
  moduleSpecifiersOf,
  moduleTarget,
  type SourceFile,
  sourceFiles,
} from './source-index';

const PLATFORM = 'platform';

const ownerOfPath = (path: string): string => contextOf(path) ?? PLATFORM;

const ownerOfTable = (name: string): string | null => {
  const table = tableNamed(name);

  return table ? ownerOfPath(table.file) : null;
};

const TABLE_NAMES: ReadonlySet<string> = new Set(
  DRIZZLE_TABLES.map((table) => table.name),
);

const RAW_TABLE =
  /\b(?:from|join|into|update|delete\s+from|table)\s+(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;

const SQL_TAGS = /^sql(\.raw)?\b/;

const sqlTextsOf = (file: SourceFile): { node: ts.Node; text: string }[] => [
  ...descendants(file.tree, ts.isTaggedTemplateExpression)
    .filter((tagged) => SQL_TAGS.test(tagged.tag.getText()))
    .map((tagged) => ({
      node: tagged as ts.Node,
      text: ts.isNoSubstitutionTemplateLiteral(tagged.template)
        ? tagged.template.text
        : [
            tagged.template.head.text,
            ...tagged.template.templateSpans.map((span) => span.literal.text),
          ].join(' '),
    })),
  ...descendants(file.tree, ts.isCallExpression)
    .filter((call) => call.expression.getText() === 'sql.raw')
    .flatMap((call) => {
      const argument = call.arguments[0];

      return argument && ts.isStringLiteralLike(argument)
        ? [{ node: call as ts.Node, text: argument.text }]
        : [];
    }),
];

const at = (file: SourceFile, node: ts.Node): string =>
  `${file.path}:${file.tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

const foreignSchemaImports = (file: SourceFile, owner: string): Violation[] =>
  moduleSpecifiersOf(file).flatMap((specifier) => {
    const target = moduleTarget(file.path, specifier);

    if (!target?.endsWith('.schema') || target.endsWith('/env.schema')) {
      return [];
    }

    const schemaOwner = ownerOfPath(target);

    return schemaOwner === owner
      ? []
      : [
          {
            key: `${file.path}: imports the schema of ${schemaOwner} (${target})`,
            at: file.path,
          },
        ];
  });

const foreignRawTables = (file: SourceFile, owner: string): Violation[] =>
  sqlTextsOf(file).flatMap(({ node, text }) =>
    [...text.matchAll(RAW_TABLE)].flatMap(([, name]) => {
      const tableOwner =
        name && TABLE_NAMES.has(name) ? ownerOfTable(name) : null;

      return tableOwner && tableOwner !== owner
        ? [
            {
              key: `${file.path}: names ${name} of ${tableOwner} in SQL`,
              at: at(file, node),
            },
          ]
        : [];
    }),
  );

export const tableAccessIn = (file: SourceFile): Violation[] => {
  const owner = ownerOfPath(file.path);

  return [
    ...foreignSchemaImports(file, owner),
    ...foreignRawTables(file, owner),
  ];
};

export const crossOwnerForeignKeys = (): Violation[] =>
  SNAPSHOT_FOREIGN_KEYS.flatMap((key) => {
    const from = ownerOfTable(key.tableFrom);
    const to = ownerOfTable(key.tableTo);

    return from && to && from !== to
      ? [
          {
            key: `${key.tableFrom} of ${from} references ${key.tableTo} of ${to}`,
            at: tableNamed(key.tableFrom)?.file ?? key.tableFrom,
          },
        ]
      : [];
  });

export const tableOwnershipViolations = (): Violation[] => [
  ...sourceFiles().flatMap(tableAccessIn),
  ...crossOwnerForeignKeys(),
];
