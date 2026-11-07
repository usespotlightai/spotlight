import { join } from 'node:path';
import { HttpException } from '@nestjs/common';
import { httpExceptionOf } from '@platform/http/filters/application-error.filter';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import ts from 'typescript';
import { SOURCE_ROOT, sourceFiles, withoutExtension } from './source-index';

const UNEXPECTED = 500;

const ERROR_BASES: ReadonlySet<string> = new Set([
  'ApplicationError',
  'DomainError',
  'TranslatedDomainError',
]);

const ANY_ARGUMENT: unknown = new Proxy(() => undefined, {
  get: (_target, key) => {
    if (key === Symbol.toPrimitive) {
      return (hint: string) => (hint === 'number' ? 1 : 'https://any.test/x');
    }

    if (key === Symbol.iterator) {
      return function* () {};
    }

    return key === 'then' ? undefined : ANY_ARGUMENT;
  },
  apply: () => ANY_ARGUMENT,
  construct: () => ANY_ARGUMENT as object,
});

const isExported = (node: ts.ClassDeclaration): boolean =>
  node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  ) ?? false;

const extendsSomething = (node: ts.ClassDeclaration): boolean =>
  node.heritageClauses?.some(
    (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
  ) ?? false;

const exportedClassesByFile = (): ReadonlyMap<string, readonly string[]> =>
  new Map(
    sourceFiles()
      .map((file): [string, string[]] => [
        file.path,
        file.tree.statements.flatMap((statement) =>
          ts.isClassDeclaration(statement) &&
          statement.name &&
          isExported(statement) &&
          extendsSomething(statement)
            ? [statement.name.text]
            : [],
        ),
      ])
      .filter(([, classes]) => classes.length > 0),
  );

const statusOf = (error: Error): number => {
  try {
    rethrowAsApplicationError(error);
  } catch (thrown) {
    return thrown instanceof ApplicationError
      ? httpExceptionOf(thrown).getStatus()
      : UNEXPECTED;
  }
};

type ErrorClass = new (...args: unknown[]) => Error;

const isErrorClass = (value: unknown): value is ErrorClass =>
  typeof value === 'function' &&
  value.prototype instanceof Error &&
  !(value.prototype instanceof HttpException);

export const errorStatuses = async (): Promise<Record<string, number>> => {
  const statuses: Record<string, number> = {};

  for (const [path, classes] of exportedClassesByFile()) {
    const loaded: Record<string, unknown> = await import(
      join(SOURCE_ROOT, path)
    );

    for (const name of classes) {
      const value = loaded[name];

      if (!isErrorClass(value) || ERROR_BASES.has(name)) {
        continue;
      }

      const error = new value(
        ...Array.from(
          { length: Math.max(value.length, 4) },
          () => ANY_ARGUMENT,
        ),
      );
      statuses[`${withoutExtension(path)}: ${name}`] = statusOf(error);
    }
  }

  return statuses;
};
