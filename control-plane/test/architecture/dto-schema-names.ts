import ts from 'typescript';

import { type SourceFile, sourceFiles } from './source-index';
import type { Violation } from './violation';

const API_PROPERTIES: ReadonlySet<string> = new Set([
  'ApiProperty',
  'ApiPropertyOptional',
  'ApiHideProperty',
  'ApiResponseProperty',
]);

type SchemaClass = {
  readonly name: string;
  readonly path: string;
  readonly line: number;
};

const decoratorName = (decorator: ts.Decorator): string | null => {
  const called = ts.isCallExpression(decorator.expression)
    ? decorator.expression.expression
    : decorator.expression;

  return ts.isIdentifier(called) ? called.text : null;
};

const describesSchema = (node: ts.ClassDeclaration): boolean =>
  node.members.some((member) =>
    (ts.canHaveDecorators(member) ? (ts.getDecorators(member) ?? []) : []).some(
      (decorator) => API_PROPERTIES.has(decoratorName(decorator) ?? ''),
    ),
  );

const schemaClassesIn = (file: SourceFile): SchemaClass[] => {
  const found: SchemaClass[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isClassDeclaration(node) &&
      node.name &&
      (node.name.text.endsWith('Dto') || describesSchema(node))
    ) {
      found.push({
        name: node.name.text,
        path: file.path,
        line:
          file.tree.getLineAndCharacterOfPosition(node.name.getStart(file.tree))
            .line + 1,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file.tree);

  return found;
};

export const dtoSchemaNameViolations = (): Violation[] => {
  const byName = new Map<string, SchemaClass[]>();

  for (const each of sourceFiles().flatMap(schemaClassesIn)) {
    byName.set(each.name, [...(byName.get(each.name) ?? []), each]);
  }

  return [...byName.values()]
    .filter((classes) => classes.length > 1)
    .flatMap((classes) =>
      classes.map((each) => ({
        key: `${each.name} names ${classes.length} OpenAPI schemas, ${classes
          .map((other) => other.path)
          .sort()
          .join(' and ')}`,
        at: `${each.path}:${each.line}`,
      })),
    );
};
