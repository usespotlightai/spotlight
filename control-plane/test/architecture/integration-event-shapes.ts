import ts from 'typescript';

import { sourceFiles } from './source-index';

const INTEGRATION_EVENTS = 'shared-kernel/application/integration-events/';

const printer = ts.createPrinter({ removeComments: true });

// The published payload of each integration event file: its kinds and its types, without comments.
export const integrationEventShapes = (): Record<string, string[]> =>
  Object.fromEntries(
    sourceFiles(INTEGRATION_EVENTS)
      .map(
        (file) =>
          [
            file.path.slice(INTEGRATION_EVENTS.length),
            file.tree.statements
              .filter(
                (statement) =>
                  ts.isTypeAliasDeclaration(statement) ||
                  ts.isInterfaceDeclaration(statement) ||
                  ts.isVariableStatement(statement),
              )
              .map((statement) =>
                printer
                  .printNode(ts.EmitHint.Unspecified, statement, file.tree)
                  .replace(/\s+/g, ' '),
              ),
          ] as const,
      )
      .sort(([one], [other]) => one.localeCompare(other)),
  );
