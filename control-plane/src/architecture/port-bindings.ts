import ts from 'typescript';
import { reachableFrom } from './context-dependencies';
import type { Violation } from './known-violations';
import {
  contextOf,
  descendants,
  importsOf,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';

const PORT = /^contexts\/([^/]+)\/application\/ports\//;

const tokenOf = (
  identifier: ts.Expression,
  file: SourceFile,
): string | null => {
  if (!ts.isIdentifier(identifier)) {
    return null;
  }

  const imported = importsOf(file).find(
    (each) => each.local === identifier.text,
  );

  return imported
    ? `${imported.target}#${imported.exported}`
    : `${withoutExtension(file.path)}#${identifier.text}`;
};

const propertyNamed = (
  literal: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined => {
  const property = literal.properties.find(
    (each) =>
      ts.isPropertyAssignment(each) &&
      ts.isIdentifier(each.name) &&
      each.name.text === name,
  );

  return property && ts.isPropertyAssignment(property)
    ? property.initializer
    : undefined;
};

const providersOf = (
  files: readonly SourceFile[],
): Map<string, Set<string>> => {
  const providers = new Map<string, Set<string>>();

  for (const file of files) {
    const context = contextOf(file.path);

    if (!context) {
      continue;
    }

    for (const literal of descendants(
      file.tree,
      ts.isObjectLiteralExpression,
    )) {
      const provided = propertyNamed(literal, 'provide');
      const token = provided ? tokenOf(provided, file) : null;

      if (token && PORT.test(token)) {
        providers.set(
          token,
          new Set([...(providers.get(token) ?? []), context]),
        );
      }
    }
  }

  return providers;
};

export const portBindingViolations = (): Violation[] => {
  const files = sourceFiles('contexts');
  const providers = providersOf(files);

  return files.flatMap((file) => {
    const consumer = contextOf(file.path) as string;
    const upstream = reachableFrom(consumer);

    return descendants(file.tree, ts.isObjectLiteralExpression).flatMap(
      (literal) => {
        const injected = propertyNamed(literal, 'inject');

        if (!injected || !ts.isArrayLiteralExpression(injected)) {
          return [];
        }

        return injected.elements.flatMap((element) => {
          const token = tokenOf(element, file);
          const declarer = token ? PORT.exec(token)?.[1] : undefined;

          if (!token || !declarer || declarer === consumer) {
            return [];
          }

          return [...(providers.get(token) ?? [])]
            .filter(
              (provider) => provider !== consumer && !upstream.has(provider),
            )
            .map((provider) => ({
              key: `${file.path}: ${consumer} injects ${token.split('#')[1]} of ${declarer}, bound by ${provider}, which is not upstream`,
              at: file.path,
            }));
        });
      },
    );
  });
};
