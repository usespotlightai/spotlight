import { basename } from 'node:path';
import ts from 'typescript';
import { tableNamed } from './drizzle-tables';
import type { Violation } from './known-violations';
import {
  descendants,
  importsOf,
  type SourceFile,
  sourceFiles,
} from './source-index';

const AGGREGATE_TABLES: Readonly<Record<string, string>> = {
  'replays/candidate': 'replay_candidate',
  'replays/search': 'replay_search',
  'integrations/hook-callback-token': 'hook_callback',
  'github/pull-request': 'github_pull_request',
  'insights/task-human-actions': 'task_human_action',
};

const hasVersionMember = (declaration: ts.ClassDeclaration): boolean =>
  declaration.members.some((member) => {
    if (
      (ts.isPropertyDeclaration(member) ||
        ts.isGetAccessorDeclaration(member)) &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'version'
    ) {
      return true;
    }

    return (
      ts.isConstructorDeclaration(member) &&
      member.parameters.some(
        (parameter) =>
          ts.isIdentifier(parameter.name) &&
          parameter.name.text === 'version' &&
          (ts.getCombinedModifierFlags(parameter) &
            (ts.ModifierFlags.Readonly |
              ts.ModifierFlags.Public |
              ts.ModifierFlags.Protected)) !==
            0,
      )
    );
  });

type Aggregate = {
  readonly file: SourceFile;
  readonly tableName: string;
};

const AGGREGATES: readonly Aggregate[] = sourceFiles('contexts')
  .filter((file) =>
    /\/domain\/aggregates\/[^/]+\.aggregate\.ts$/.test(file.path),
  )
  .map((file) => {
    const context = file.path.split('/')[1] as string;
    const aggregate = basename(file.path, '.aggregate.ts');

    return {
      file,
      tableName:
        AGGREGATE_TABLES[`${context}/${aggregate}`] ??
        aggregate.replaceAll('-', '_'),
    };
  });

export const AGGREGATE_TABLE_NAMES: ReadonlySet<string> = new Set(
  AGGREGATES.map((aggregate) => aggregate.tableName),
);

export const aggregateVersionViolations = (): Violation[] =>
  AGGREGATES.flatMap(({ file, tableName }) => {
    const table = tableNamed(tableName);
    const classes = file.tree.statements.filter(
      (statement): statement is ts.ClassDeclaration =>
        ts.isClassDeclaration(statement) &&
        (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) !==
          0,
    );
    const member = classes.some(hasVersionMember)
      ? []
      : [{ key: `${file.path}: no version on the aggregate`, at: file.path }];
    const column = !table
      ? [
          {
            key: `${file.path}: no table ${tableName}; name it in AGGREGATE_TABLES`,
            at: file.path,
          },
        ]
      : table.versioned
        ? []
        : [
            {
              key: `${file.path}: no version column on ${tableName}`,
              at: table.file,
            },
          ];

    return [...member, ...column];
  });

const AGGREGATE_FILE =
  /^contexts\/[^/]+\/domain\/aggregates\/[^/]+\.aggregate$/;
const PERSISTING_METHODS: ReadonlySet<string> = new Set([
  'add',
  'delete',
  'remove',
  'save',
  'saveAll',
  'store',
]);

const persistedTypesIn = (file: SourceFile): Violation[] => {
  const imported = new Map(
    importsOf(file).map((each) => [each.local, each.target] as const),
  );

  return descendants(file.tree, ts.isMethodSignature)
    .filter(
      (method) =>
        ts.isIdentifier(method.name) &&
        PERSISTING_METHODS.has(method.name.text),
    )
    .flatMap((method) =>
      method.parameters.flatMap((parameter) =>
        parameter.type
          ? descendants(parameter.type, ts.isTypeReferenceNode).flatMap(
              (reference) => {
                const name = reference.typeName.getText();
                const target = imported.get(name);

                return target &&
                  /\/domain\//.test(target) &&
                  !AGGREGATE_FILE.test(target)
                  ? [
                      {
                        key: `${target}: ${name} is stored by a repository outside domain/aggregates`,
                        at: file.path,
                      },
                    ]
                  : [];
              },
            )
          : [],
      ),
    );
};

const recordersOutsideAggregates = (file: SourceFile): Violation[] =>
  AGGREGATE_FILE.test(file.path.replace(/\.ts$/, ''))
    ? []
    : descendants(file.tree, ts.isClassDeclaration)
        .filter((declaration) =>
          (declaration.heritageClauses ?? []).some(
            (clause) =>
              clause.token === ts.SyntaxKind.ExtendsKeyword &&
              clause.types.some(
                (type) => type.expression.getText() === 'EventRecorder',
              ),
          ),
        )
        .map((declaration) => ({
          key: `${file.path.replace(/\.ts$/, '')}: ${declaration.name?.text ?? 'a class'} records events outside domain/aggregates`,
          at: file.path,
        }));

export const misplacedAggregateViolations = (): Violation[] => [
  ...sourceFiles('contexts')
    .filter((file) => /\/domain\/repositories\//.test(file.path))
    .flatMap(persistedTypesIn),
  ...sourceFiles('contexts').flatMap(recordersOutsideAggregates),
];
