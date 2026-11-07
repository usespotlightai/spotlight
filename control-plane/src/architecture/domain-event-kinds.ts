import ts from 'typescript';
import {
  contextOf,
  descendants,
  type SourceFile,
  sourceFiles,
} from './source-index';

export const KIND_PATTERN = /^[a-z][a-z-]*\.[a-z][a-z-]*(\.v\d+)?$/;
export const INTEGRATION_EVENT_KIND = /^([a-z-]+)\.[a-z-]+\.v\d+$/;
export const INTEGRATION_EVENTS =
  'shared-kernel/application/integration-events/';

export const isDomainEventsPath = (path: string): boolean =>
  /^contexts\/[^/]+\/domain\/events\//.test(path);

const kindOf = (declaration: ts.ClassDeclaration): string | null => {
  for (const member of declaration.members) {
    if (
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'kind' &&
      member.initializer &&
      ts.isStringLiteralLike(member.initializer) &&
      KIND_PATTERN.test(member.initializer.text)
    ) {
      return member.initializer.text;
    }
  }

  return null;
};

const implementsDomainEvent = (declaration: ts.ClassDeclaration): boolean =>
  (declaration.heritageClauses ?? []).some(
    (clause) =>
      clause.token === ts.SyntaxKind.ImplementsKeyword &&
      clause.types.some((type) => type.expression.getText() === 'DomainEvent'),
  );

export type DeclaredEvent = {
  readonly name: string;
  readonly kind: string | null;
  readonly context: string | null;
  readonly file: SourceFile;
  readonly line: number;
};

export const eventClassesOf = (file: SourceFile): DeclaredEvent[] =>
  descendants(file.tree, ts.isClassDeclaration).flatMap((declaration) => {
    const kind = kindOf(declaration);

    if (
      !declaration.name ||
      (kind === null && !implementsDomainEvent(declaration))
    ) {
      return [];
    }

    return [
      {
        name: declaration.name.text,
        kind,
        context: contextOf(file.path),
        file,
        line:
          file.tree.getLineAndCharacterOfPosition(declaration.getStart()).line +
          1,
      },
    ];
  });

export const DECLARED_EVENTS: readonly DeclaredEvent[] =
  sourceFiles('contexts').flatMap(eventClassesOf);

export const DOMAIN_EVENT_OWNERS: ReadonlyMap<string, readonly string[]> =
  DECLARED_EVENTS.reduce((owners, event) => {
    if (event.kind && event.context) {
      owners.set(event.kind, [
        ...new Set([...(owners.get(event.kind) ?? []), event.context]),
      ]);
    }

    return owners;
  }, new Map<string, string[]>());

export const INTEGRATION_EVENT_KINDS: ReadonlySet<string> = new Set(
  sourceFiles(INTEGRATION_EVENTS).flatMap((file) =>
    descendants(file.tree, ts.isStringLiteralLike)
      .map((literal) => literal.text)
      .filter((text) => INTEGRATION_EVENT_KIND.test(text)),
  ),
);

export const publisherOfKind = (kind: string): string | null =>
  INTEGRATION_EVENT_KIND.exec(kind)?.[1] ?? null;
