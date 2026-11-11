import ts from 'typescript';

import {
  descendants,
  importsOf,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';

export type DrizzleTable = {
  readonly binding: string;
  readonly name: string;
  readonly file: string;
  readonly versioned: boolean;
};

const isTableCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'pgTable';

const hasVersionColumn = (call: ts.CallExpression): boolean => {
  const columns = call.arguments[1];

  return (
    !!columns &&
    ts.isObjectLiteralExpression(columns) &&
    columns.properties.some(
      (property) =>
        property.name !== undefined &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'version',
    )
  );
};

const tablesIn = (file: SourceFile): DrizzleTable[] =>
  descendants(file.tree, ts.isVariableDeclaration).flatMap((declaration) => {
    const call = declaration.initializer;

    if (
      !call ||
      !isTableCall(call) ||
      !ts.isIdentifier(declaration.name) ||
      !call.arguments[0] ||
      !ts.isStringLiteralLike(call.arguments[0])
    ) {
      return [];
    }

    return [
      {
        binding: declaration.name.text,
        name: call.arguments[0].text,
        file: file.path,
        versioned: hasVersionColumn(call),
      },
    ];
  });

export const DRIZZLE_TABLES: readonly DrizzleTable[] = sourceFiles()
  .filter((file) => file.path.endsWith('.schema.ts'))
  .flatMap(tablesIn);

const byModule = new Map<string, Map<string, DrizzleTable>>();

for (const table of DRIZZLE_TABLES) {
  const module = withoutExtension(table.file);
  const tables = byModule.get(module) ?? new Map<string, DrizzleTable>();
  tables.set(table.binding, table);
  byModule.set(module, tables);
}

export const tableBindingsOf = (
  file: SourceFile,
): ReadonlyMap<string, DrizzleTable> => {
  const bindings = new Map<string, DrizzleTable>(
    byModule.get(withoutExtension(file.path)) ?? [],
  );

  for (const imported of importsOf(file)) {
    const tables = byModule.get(imported.target);

    if (imported.exported === '*') {
      for (const [binding, table] of tables ?? []) {
        bindings.set(`${imported.local}.${binding}`, table);
      }
    }

    const table = tables?.get(imported.exported);

    if (table) {
      bindings.set(imported.local, table);
    }
  }

  return bindings;
};

export const tableNamed = (name: string): DrizzleTable | undefined =>
  DRIZZLE_TABLES.find((table) => table.name === name);
