import { basename } from 'node:path';
import ts from 'typescript';
import { tableNamed } from './drizzle-tables';
import type { Violation } from './known-violations';
import { type SourceFile, sourceFiles } from './source-index';

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
