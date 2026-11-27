import { present } from '@shared-kernel/domain/present.fake-spec';
import ts from 'typescript';

import { reachableFrom } from './context-dependencies';
import {
  contextOf,
  descendants,
  importsOf,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';
import type { Violation } from './violation';

const PORT = /^contexts\/([^/]+)\/application\/(?:ports|contracts)\//;

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

    if (context === null || context === '') {
      continue;
    }

    for (const literal of descendants(
      file.tree,
      ts.isObjectLiteralExpression,
    )) {
      const provided = propertyNamed(literal, 'provide');
      const token = provided ? tokenOf(provided, file) : null;

      if (token !== null && token !== '' && PORT.test(token)) {
        providers.set(
          token,
          new Set([...(providers.get(token) ?? []), context]),
        );
      }
    }
  }

  return providers;
};

const injectedIn = (file: SourceFile): ts.Expression[] => [
  ...descendants(file.tree, ts.isObjectLiteralExpression).flatMap((literal) => {
    const injected = propertyNamed(literal, 'inject');
    const existing = propertyNamed(literal, 'useExisting');

    return [
      ...(injected && ts.isArrayLiteralExpression(injected)
        ? injected.elements
        : []),
      ...(existing ? [existing] : []),
    ];
  }),
  ...descendants(file.tree, ts.isDecorator).flatMap((decorator) =>
    ts.isCallExpression(decorator.expression) &&
    ts.isIdentifier(decorator.expression.expression) &&
    decorator.expression.expression.text === 'Inject'
      ? decorator.expression.arguments.slice(0, 1)
      : [],
  ),
];

export type PortBinding = {
  readonly consumer: string;
  readonly token: string;
  readonly declarer: string;
  readonly provider: string;
  readonly file: string;
};

/** Every injection of another context's port, with each context whose wiring binds it. */
export const portBindings = (): PortBinding[] => {
  const files = sourceFiles('contexts');
  const providers = providersOf(files);

  return files.flatMap((file) => {
    const consumer = present(contextOf(file.path));

    return injectedIn(file).flatMap((element) => {
      const token = tokenOf(element, file);
      const declarer =
        token !== null && token !== '' ? PORT.exec(token)?.[1] : undefined;

      if (
        token === null ||
        token === '' ||
        declarer === undefined ||
        declarer === '' ||
        declarer === consumer
      ) {
        return [];
      }

      return [...(providers.get(token) ?? [])]
        .filter((provider) => provider !== consumer)
        .map((provider) => ({
          consumer,
          token,
          declarer,
          provider,
          file: file.path,
        }));
    });
  });
};

export const portBindingViolations = (): Violation[] =>
  portBindings()
    .filter(({ consumer, provider }) => !reachableFrom(consumer).has(provider))
    .map(({ consumer, token, declarer, provider, file }) => ({
      key: `${file}: ${consumer} injects ${token.split('#')[1]} of ${declarer}, bound by ${provider}, which is not upstream`,
      at: file,
    }));
