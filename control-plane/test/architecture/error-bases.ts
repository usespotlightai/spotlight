import ts from 'typescript';
import type { Violation } from './known-violations';
import {
  importsOf,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';

const DOMAIN_ERROR = 'DomainError';
const APPLICATION_ERROR = 'ApplicationError';
const PLAIN_BASES: ReadonlySet<string> = new Set([
  'Error',
  'EvalError',
  'HttpException',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

const ERROR_KINDS: ReadonlySet<string> = new Set([
  'conflict',
  'invalid',
  'not-allowed',
  'not-found',
  'upstream-error',
  'internal',
]);

type DeclaredClass = {
  readonly id: string;
  readonly name: string;
  readonly base: string | null;
  readonly declaresKind: boolean;
  readonly path: string;
  readonly line: number;
};

const isDomainLayer = (path: string): boolean =>
  /^(contexts\/[^/]+|shared-kernel)\/domain\//.test(path);

const idOf = (module: string, name: string): string => `${module}#${name}`;

const baseOf = (
  node: ts.ClassDeclaration,
  file: SourceFile,
  declaredHere: ReadonlySet<string>,
): string | null => {
  const extended = node.heritageClauses?.find(
    (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
  )?.types[0]?.expression;

  if (!extended) {
    return null;
  }

  const [head, ...rest] = extended.getText().split('.');
  const imported = importsOf(file).find((each) => each.local === head);

  if (imported) {
    return imported.exported === '*'
      ? idOf(imported.target, rest.join('.'))
      : idOf(imported.target, imported.exported);
  }

  if (rest.length === 0 && declaredHere.has(head as string)) {
    return idOf(withoutExtension(file.path), head as string);
  }

  return extended.getText();
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
  const declaredHere = new Set(
    file.tree.statements.flatMap((statement) =>
      ts.isClassDeclaration(statement) && statement.name
        ? [statement.name.text]
        : [],
    ),
  );
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      found.push({
        id: idOf(withoutExtension(file.path), node.name.text),
        name: node.name.text,
        base: baseOf(node, file, declaredHere),
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

const nameOfId = (id: string): string => id.slice(id.lastIndexOf('#') + 1);

const rootOf = (
  declared: DeclaredClass,
  byId: ReadonlyMap<string, DeclaredClass>,
): string | null => {
  let base = declared.base;
  const seen = new Set<string>();

  while (base !== null && !seen.has(base)) {
    const known = byId.get(base);

    if (!known) {
      const name = nameOfId(base);

      return name === DOMAIN_ERROR ||
        name === APPLICATION_ERROR ||
        PLAIN_BASES.has(name)
        ? name
        : null;
    }

    if (known.name === DOMAIN_ERROR || known.name === APPLICATION_ERROR) {
      return known.name;
    }

    seen.add(base);
    base = known.base;
  }

  return null;
};

const violation = (declared: DeclaredClass, rule: string): Violation => ({
  key: `${declared.path.replace(/\.ts$/, '')}: ${declared.name} ${rule}`,
  at: `${declared.path}:${declared.line}`,
});

export const errorBaseViolations = (): Violation[] => {
  const declared = sourceFiles().flatMap(classesIn);
  const byId = new Map(declared.map((each) => [each.id, each]));

  return declared.flatMap((each) => {
    if (each.name === DOMAIN_ERROR || each.name === APPLICATION_ERROR) {
      return [];
    }

    const root = rootOf(each, byId);

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
