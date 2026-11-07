import ts from 'typescript';
import type { Violation } from './known-violations';
import { type SourceFile, sourceFiles } from './source-index';

const DOMAIN_ERROR = 'DomainError';
const APPLICATION_ERROR = 'ApplicationError';
const PLAIN_BASES: ReadonlySet<string> = new Set(['Error', 'HttpException']);

const ERROR_KINDS: ReadonlySet<string> = new Set([
  'conflict',
  'invalid',
  'not-allowed',
  'not-found',
  'upstream-error',
  'internal',
]);

type DeclaredClass = {
  readonly name: string;
  readonly base: string | null;
  readonly declaresKind: boolean;
  readonly path: string;
  readonly line: number;
};

const isDomainLayer = (path: string): boolean =>
  /^(contexts\/[^/]+|shared-kernel)\/domain\//.test(path);

const baseOf = (node: ts.ClassDeclaration): string | null => {
  const extended = node.heritageClauses?.find(
    (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
  )?.types[0]?.expression;

  return extended && ts.isIdentifier(extended) ? extended.text : null;
};

const declaresErrorKind = (node: ts.ClassDeclaration): boolean =>
  node.members.some(
    (member) =>
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'kind' &&
      member.initializer !== undefined &&
      ts.isStringLiteral(
        ts.isAsExpression(member.initializer)
          ? member.initializer.expression
          : member.initializer,
      ) &&
      ERROR_KINDS.has(
        (
          (ts.isAsExpression(member.initializer)
            ? member.initializer.expression
            : member.initializer) as ts.StringLiteral
        ).text,
      ),
  );

const classesIn = (file: SourceFile): DeclaredClass[] => {
  const found: DeclaredClass[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      found.push({
        name: node.name.text,
        base: baseOf(node),
        declaresKind: declaresErrorKind(node),
        path: file.path,
        line: file.tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }

    ts.forEachChild(node, visit);
  };
  visit(file.tree);

  return found;
};

const rootOf = (
  declared: DeclaredClass,
  byName: ReadonlyMap<string, DeclaredClass>,
): string | null => {
  let base = declared.base;
  const seen = new Set<string>();

  while (base !== null && !seen.has(base)) {
    if (
      base === DOMAIN_ERROR ||
      base === APPLICATION_ERROR ||
      PLAIN_BASES.has(base)
    ) {
      return base;
    }

    seen.add(base);
    base = byName.get(base)?.base ?? null;
  }

  return null;
};

const violation = (declared: DeclaredClass, rule: string): Violation => ({
  key: `${declared.path.replace(/\.ts$/, '')}: ${declared.name} ${rule}`,
  at: `${declared.path}:${declared.line}`,
});

export const errorBaseViolations = (): Violation[] => {
  const declared = sourceFiles().flatMap(classesIn);
  const byName = new Map(declared.map((each) => [each.name, each]));

  return declared.flatMap((each) => {
    if (each.name === DOMAIN_ERROR || each.name === APPLICATION_ERROR) {
      return [];
    }

    const root = rootOf(each, byName);

    if (root === null) {
      return [];
    }

    if (isDomainLayer(each.path) && root !== DOMAIN_ERROR) {
      return [
        violation(each, 'is a domain error that does not extend DomainError'),
      ];
    }

    if (!isDomainLayer(each.path) && root === DOMAIN_ERROR) {
      return [violation(each, 'extends DomainError outside the domain layer')];
    }

    return each.declaresKind && PLAIN_BASES.has(root)
      ? [
          violation(
            each,
            'declares an error kind but extends neither DomainError nor ApplicationError',
          ),
        ]
      : [];
  });
};
