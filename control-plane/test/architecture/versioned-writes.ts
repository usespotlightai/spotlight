import ts from 'typescript';
import {
  type DrizzleTable,
  tableBindingsOf,
  tableNamed,
} from './drizzle-tables';
import { descendants, type SourceFile, sourceFiles } from './source-index';
import type { Violation } from './violation';

type Write = 'update' | 'delete' | 'upsert';

const chainOf = (call: ts.CallExpression): ts.Node => {
  let top: ts.Node = call;

  while (
    (ts.isPropertyAccessExpression(top.parent) &&
      top.parent.expression === top) ||
    (ts.isCallExpression(top.parent) && top.parent.expression === top)
  ) {
    top = top.parent;
  }

  return top;
};

const methodOf = (call: ts.CallExpression): string | null =>
  ts.isPropertyAccessExpression(call.expression)
    ? call.expression.name.text
    : null;

const callsIn = (chain: ts.Node, method: string): ts.CallExpression[] =>
  descendants(chain, ts.isCallExpression).filter(
    (call) => methodOf(call) === method,
  );

const isNamedDeclaration = (node: ts.Node): node is ts.NamedDeclaration =>
  ts.isVariableDeclaration(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isPropertyDeclaration(node);

const scopeOf = (declaration: ts.NamedDeclaration): ts.Node => {
  let scope: ts.Node = declaration.parent;

  while (
    !ts.isBlock(scope) &&
    !ts.isSourceFile(scope) &&
    !ts.isClassLike(scope) &&
    !ts.isFunctionLike(scope)
  ) {
    scope = scope.parent;
  }

  return scope;
};

const contains = (scope: ts.Node, node: ts.Node): boolean =>
  scope.getStart() <= node.getStart() && node.getEnd() <= scope.getEnd();

const isReference = (identifier: ts.Identifier): boolean => {
  const parent = identifier.parent;

  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) {
    return parent.expression.kind === ts.SyntaxKind.ThisKeyword;
  }

  return !(
    (ts.isPropertyAssignment(parent) && parent.name === identifier) ||
    (isNamedDeclaration(parent) && parent.name === identifier)
  );
};

const declarationOf = (
  identifier: ts.Identifier,
  declarations: readonly ts.NamedDeclaration[],
): ts.NamedDeclaration | undefined =>
  declarations
    .filter(
      (declaration) =>
        declaration.name !== undefined &&
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === identifier.text &&
        contains(scopeOf(declaration), identifier),
    )
    .sort(
      (one, other) =>
        scopeOf(one).getWidth() - scopeOf(other).getWidth() ||
        other.getStart() - one.getStart(),
    )[0];

const conditionText = (
  roots: readonly ts.Node[],
  declarations: readonly ts.NamedDeclaration[],
): string => {
  const seen = new Set<ts.Node>();
  let frontier: readonly ts.Node[] = roots;
  let text = roots.map((root) => root.getText()).join('\n');

  for (let depth = 0; depth < 3 && frontier.length > 0; depth += 1) {
    const referenced = frontier
      .flatMap((node) => descendants(node, ts.isIdentifier))
      .filter(isReference)
      .flatMap((identifier) => declarationOf(identifier, declarations) ?? [])
      .filter((declaration) => !seen.has(declaration));

    for (const declaration of referenced) {
      seen.add(declaration);
      text += `\n${declaration.getText()}`;
    }

    frontier = referenced;
  }

  return text;
};

const conditionsOf = (chain: ts.Node, write: Write): ts.Node[] =>
  write === 'upsert'
    ? callsIn(chain, 'onConflictDoUpdate').flatMap((call) =>
        descendants(call, ts.isPropertyAssignment).filter(
          (property) =>
            ts.isIdentifier(property.name) &&
            ['where', 'setWhere'].includes(property.name.text),
        ),
      )
    : callsIn(chain, 'where').flatMap((call) => [...call.arguments]);

const assignmentsOf = (chain: ts.Node, write: Write): ts.Node[] =>
  write === 'upsert'
    ? callsIn(chain, 'onConflictDoUpdate').flatMap((call) =>
        descendants(call, ts.isPropertyAssignment).filter(
          (property) =>
            ts.isIdentifier(property.name) && property.name.text === 'set',
        ),
      )
    : callsIn(chain, 'set').flatMap((call) => [...call.arguments]);

const raisesVersion = (text: string): boolean =>
  /(^|[{,\s])version\s*[:,}]/m.test(text);

const comparesVersion = (text: string, binding: string): boolean =>
  new RegExp(`\\beq\\(\\s*${binding.replaceAll('.', '\\.')}\\.version\\b`).test(
    text,
  );

const at = (file: SourceFile, node: ts.Node): string =>
  `${file.path}:${file.tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

const violation = (
  file: SourceFile,
  node: ts.Node,
  write: Write,
  table: DrizzleTable,
): Violation => ({
  key: `${file.path}: ${write} ${table.name} without its version`,
  at: at(file, node),
});

const writeOf = (call: ts.CallExpression, chain: ts.Node): Write | null => {
  const method = methodOf(call);

  if (method === 'update' || method === 'delete') {
    return method;
  }

  return method === 'insert' && callsIn(chain, 'onConflictDoUpdate').length > 0
    ? 'upsert'
    : null;
};

const isTableReference = (node: ts.Node): boolean =>
  ts.isIdentifier(node) ||
  (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression));

const builderWrites = (file: SourceFile): Violation[] => {
  const tables = tableBindingsOf(file);
  const declarations = descendants(file.tree, isNamedDeclaration);

  return descendants(file.tree, ts.isCallExpression).flatMap((call) => {
    const argument = call.arguments[0];
    const chain = chainOf(call);
    const write = writeOf(call, chain);

    if (!write || !argument || !isTableReference(argument)) {
      return [];
    }

    const binding = argument.getText();
    const table = tables.get(binding);

    if (!table) {
      return write !== 'upsert' &&
        (callsIn(chain, 'where').length > 0 || callsIn(chain, 'set').length > 0)
        ? [
            {
              key: `${file.path}: ${write} of a table the check cannot resolve`,
              at: at(file, call),
            },
          ]
        : [];
    }

    if (!table.versioned) {
      return [];
    }

    const compared = comparesVersion(
      conditionText(conditionsOf(chain, write), declarations),
      binding,
    )
      ? []
      : [violation(file, call, write, table)];
    const raised =
      write === 'delete' ||
      raisesVersion(conditionText(assignmentsOf(chain, write), declarations))
        ? []
        : [
            {
              key: `${file.path}: ${write} ${table.name} without raising its version`,
              at: at(file, call),
            },
          ];

    return [...compared, ...raised];
  });
};

const TABLE_NAME = String.raw`(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?`;
const RAW_WRITE = new RegExp(
  String.raw`\b(update|delete\s+from)\s+${TABLE_NAME}`,
  'gi',
);
const RAW_UPSERT = new RegExp(
  String.raw`\binsert\s+into\s+${TABLE_NAME}[\s\S]*\bdo\s+update\b`,
  'gi',
);
const RAW_WRITE_BEFORE_TABLE = /\b(update|delete\s+from)\s*"?$/i;

const rawWriteOf = (keyword: string): Write =>
  keyword.toLowerCase() === 'update' ? 'update' : 'delete';

const namedRawWrites = (
  file: SourceFile,
  node: ts.Node,
  text: string,
): Violation[] => [
  ...[...text.matchAll(RAW_WRITE)].flatMap(([, keyword, name]) => {
    const table = tableNamed(name as string);

    return table?.versioned
      ? [violation(file, node, rawWriteOf(keyword as string), table)]
      : [];
  }),
  ...[...text.matchAll(RAW_UPSERT)].flatMap(([, name]) => {
    const table = tableNamed(name as string);

    return table?.versioned ? [violation(file, node, 'upsert', table)] : [];
  }),
];

const interpolatedRawWrites = (
  file: SourceFile,
  template: ts.TemplateExpression,
): Violation[] => {
  const tables = tableBindingsOf(file);
  const texts = [
    template.head.text,
    ...template.templateSpans.map((span) => span.literal.text),
  ];

  return template.templateSpans.flatMap((span, index) => {
    const keyword = (texts[index] as string).match(RAW_WRITE_BEFORE_TABLE)?.[1];
    const table = isTableReference(span.expression)
      ? tables.get(span.expression.getText())
      : undefined;

    return keyword && table?.versioned
      ? [violation(file, template, rawWriteOf(keyword), table)]
      : [];
  });
};

const isSqlRaw = (call: ts.CallExpression): boolean =>
  call.expression.getText() === 'sql.raw';

const rawWrites = (file: SourceFile): Violation[] => [
  ...descendants(file.tree, ts.isTaggedTemplateExpression)
    .filter((tagged) => /^sql\b/.test(tagged.tag.getText()))
    .flatMap((tagged) =>
      ts.isNoSubstitutionTemplateLiteral(tagged.template)
        ? namedRawWrites(file, tagged, tagged.template.text)
        : [
            ...namedRawWrites(
              file,
              tagged,
              [
                tagged.template.head.text,
                ...tagged.template.templateSpans.map(
                  (span) => span.literal.text,
                ),
              ].join(' '),
            ),
            ...interpolatedRawWrites(file, tagged.template),
          ],
    ),
  ...descendants(file.tree, ts.isCallExpression)
    .filter(isSqlRaw)
    .flatMap((call) => {
      const argument = call.arguments[0];

      return argument && ts.isStringLiteralLike(argument)
        ? namedRawWrites(file, call, argument.text)
        : [];
    }),
];

export const versionedWritesIn = (file: SourceFile): Violation[] => [
  ...builderWrites(file),
  ...rawWrites(file),
];

export const versionedWriteViolations = (): Violation[] =>
  sourceFiles().flatMap(versionedWritesIn);
