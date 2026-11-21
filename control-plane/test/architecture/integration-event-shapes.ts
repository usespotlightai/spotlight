import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

import { sourceFiles } from './source-index';

const INTEGRATION_EVENTS = 'shared-kernel/application/integration-events/';

const PUBLISHED_SHAPES = join(__dirname, 'integration-event-shapes.json');

const printer = ts.createPrinter({ removeComments: true });

const nameOf = (statement: ts.Statement): string | null => {
  if (
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement)
  ) {
    return statement.name.text;
  }

  if (ts.isVariableStatement(statement)) {
    const [declaration] = statement.declarationList.declarations;

    return declaration && ts.isIdentifier(declaration.name)
      ? declaration.name.text
      : null;
  }

  return null;
};

// Each declaration of the integration event files, by file and name: the kinds and the payload types, printed without comments.
export const integrationEventShapes = (): Record<string, string> =>
  Object.fromEntries(
    sourceFiles(INTEGRATION_EVENTS)
      .filter((file) => file.path.endsWith('.integration-event.ts'))
      .flatMap((file) =>
        file.tree.statements.flatMap((statement) => {
          const name = nameOf(statement);

          return name
            ? [
                [
                  `${file.path.slice(INTEGRATION_EVENTS.length)}:${name}`,
                  printer
                    .printNode(ts.EmitHint.Unspecified, statement, file.tree)
                    .replace(/\s+/g, ' '),
                ] as const,
              ]
            : [];
        }),
      )
      .sort(([one], [other]) => one.localeCompare(other)),
  );

export const publishedShapes = (): Record<string, string> =>
  existsSync(PUBLISHED_SHAPES)
    ? (JSON.parse(readFileSync(PUBLISHED_SHAPES, 'utf8')) as Record<
        string,
        string
      >)
    : {};

// A published shape that changed or is gone. A new declaration is no problem.
export const changedShapes = (
  published: Record<string, string>,
  current: Record<string, string>,
): string[] =>
  Object.entries(published).flatMap(([name, shape]) =>
    current[name] === undefined
      ? [`${name} is gone`]
      : current[name] === shape
        ? []
        : [`${name} changed from: ${shape}`],
  );

// Adds the new declarations to the published shapes. It never changes or drops a published one.
export const writeNewShapes = (): void => {
  const published = publishedShapes();
  const current = integrationEventShapes();
  const merged = { ...current, ...published };
  const sorted = Object.fromEntries(
    Object.entries(merged).sort(([one], [other]) => one.localeCompare(other)),
  );

  writeFileSync(PUBLISHED_SHAPES, `${JSON.stringify(sorted, null, 2)}\n`);
};
