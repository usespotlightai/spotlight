import ts from 'typescript';
import type { Violation } from './known-violations';
import {
  descendants,
  importsOf,
  layerOf,
  sourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';

const DOMAIN_EVENTS = /^contexts\/[^/]+\/domain\/events\//;

const eventClassesIn = (module: string): ReadonlySet<string> => {
  const file = sourceFile(`${module}.ts`);

  return new Set(
    file.tree.statements.flatMap((statement) =>
      ts.isClassDeclaration(statement) && statement.name
        ? [statement.name.text]
        : [],
    ),
  );
};

const constructedName = (created: ts.NewExpression): string | null => {
  let expression: ts.Expression = created.expression;

  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    expression = expression.expression;
  }

  return ts.isIdentifier(expression) ? expression.text : null;
};

export const domainEventConstructionViolations = (): Violation[] =>
  sourceFiles('contexts')
    .filter((file) => layerOf(file.path) !== 'domain')
    .flatMap((file) => {
      const events = new Set(
        importsOf(file)
          .filter(
            (imported) =>
              DOMAIN_EVENTS.test(imported.target) &&
              eventClassesIn(imported.target).has(imported.exported),
          )
          .map((imported) => imported.local),
      );

      return descendants(file.tree, ts.isNewExpression).flatMap((created) => {
        const name = constructedName(created);

        return name && events.has(name)
          ? [
              {
                key: `${withoutExtension(file.path)}: new ${name}`,
                at: `${file.path}:${file.tree.getLineAndCharacterOfPosition(created.getStart()).line + 1}`,
              },
            ]
          : [];
      });
    });
