import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { reachableFrom } from './context-dependencies';
import {
  DOMAIN_EVENT_OWNERS,
  INTEGRATION_EVENT_KIND,
  INTEGRATION_EVENT_KINDS,
  KIND_PATTERN,
  publisherOfKind,
} from './domain-event-kinds';
import type { Violation } from './known-violations';
import {
  contextOf,
  descendants,
  importsOf,
  SOURCE_ROOT,
  type SourceFile,
  sourceFile,
  sourceFiles,
} from './source-index';

const SANCTIONED_MATCHERS: ReadonlySet<string> = new Set([
  'shared-kernel/domain/events/configuration-changed#changesConfiguration',
]);

const isKnownKind = (text: string): boolean =>
  DOMAIN_EVENT_OWNERS.has(text) || INTEGRATION_EVENT_KINDS.has(text);

const declarationNamed = (
  file: SourceFile,
  name: string,
): ts.Node | undefined =>
  descendants(
    file.tree,
    (node): node is ts.VariableDeclaration | ts.FunctionDeclaration =>
      (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name) &&
      node.name.text === name,
  )[0];

const moduleFile = (target: string): SourceFile | null =>
  existsSync(join(SOURCE_ROOT, `${target}.ts`))
    ? sourceFile(`${target}.ts`)
    : null;

type Heard = {
  readonly kinds: ReadonlySet<string>;
  readonly sanctioned: boolean;
};

const heardIn = (root: ts.Node, file: SourceFile): Heard => {
  const kinds = new Set<string>();
  let sanctioned = false;
  const seen = new Set<ts.Node>();
  const follow = (node: ts.Node, at: SourceFile, depth: number): void => {
    if (seen.has(node) || depth > 4) {
      return;
    }

    seen.add(node);

    for (const literal of descendants(node, ts.isStringLiteralLike)) {
      if (isKnownKind(literal.text)) {
        kinds.add(literal.text);
      }
    }

    const imported = new Map(
      importsOf(at).map((each) => [each.local, each] as const),
    );

    for (const identifier of descendants(node, ts.isIdentifier)) {
      const name = identifier.text;
      const local = declarationNamed(at, name);

      if (local && local !== node && !contains(local, identifier)) {
        follow(local, at, depth + 1);
        continue;
      }

      const from = imported.get(name);

      if (!from) {
        continue;
      }

      if (SANCTIONED_MATCHERS.has(`${from.target}#${from.exported}`)) {
        sanctioned = true;
        continue;
      }

      const target = moduleFile(from.target);
      const declaration = target
        ? declarationNamed(target, from.exported)
        : undefined;

      if (target && declaration) {
        follow(declaration, target, depth + 1);
      }
    }
  };
  follow(root, file, 0);

  return { kinds, sanctioned };
};

const contains = (outer: ts.Node, inner: ts.Node): boolean =>
  outer.getStart() <= inner.getStart() && inner.getEnd() <= outer.getEnd();

const callsOf = (file: SourceFile, callee: string): ts.CallExpression[] =>
  descendants(file.tree, ts.isCallExpression).filter(
    (call) =>
      ts.isIdentifier(call.expression) && call.expression.text === callee,
  );

const at = (file: SourceFile, node: ts.Node): string =>
  `${file.path}:${file.tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

const nameOf = (call: ts.CallExpression): string => {
  const name = call.arguments[0];

  return name && ts.isStringLiteralLike(name) ? name.text : call.getText();
};

const literalKindsIn = (node: ts.Node): string[] =>
  descendants(node, ts.isStringLiteralLike)
    .map((literal) => literal.text)
    .filter((text) => KIND_PATTERN.test(text));

const problemsOfKind = (
  context: string,
  kind: string,
  { integrationEvents }: { integrationEvents: boolean },
): string[] => {
  const publisher = publisherOfKind(kind);

  if (publisher !== null) {
    if (!integrationEvents) {
      return [`hears the integration event ${kind} outside a subscriber`];
    }

    return publisher === context || reachableFrom(context).has(publisher)
      ? []
      : [`hears ${kind} of ${publisher}, which is not upstream`];
  }

  const owners = DOMAIN_EVENT_OWNERS.get(kind) ?? [];

  return owners.includes(context)
    ? []
    : owners.map((owner) => `hears the domain event ${kind} of ${owner}`);
};

const registrationViolations = (
  file: SourceFile,
  callee: 'subscribing' | 'projecting',
): Violation[] => {
  const context = contextOf(file.path);

  if (!context) {
    return [];
  }

  return callsOf(file, callee).flatMap((call) => {
    const heard = call.arguments[1];

    if (!heard) {
      return [];
    }

    const name = nameOf(call);
    const named = literalKindsIn(heard).flatMap((kind) => {
      if (INTEGRATION_EVENT_KIND.test(kind)) {
        return [`names the integration event ${kind} by string`];
      }

      return isKnownKind(kind) ? [] : [`hears the unknown kind ${kind}`];
    });
    const { kinds, sanctioned } = heardIn(heard, file);
    const owned = [...kinds].flatMap((kind) =>
      problemsOfKind(context, kind, {
        integrationEvents: callee === 'subscribing',
      }),
    );
    const unresolved =
      kinds.size === 0 && !sanctioned
        ? ['hears no kind the check can resolve']
        : [];

    return [...named, ...owned, ...unresolved].map((problem) => ({
      key: `${file.path}: ${name} ${problem}`,
      at: at(file, call),
    }));
  });
};

export const eventSubscriptionsIn = (file: SourceFile): Violation[] => [
  ...registrationViolations(file, 'subscribing'),
  ...registrationViolations(file, 'projecting'),
];

export const eventSubscriptionViolations = (): Violation[] =>
  sourceFiles('contexts').flatMap(eventSubscriptionsIn);

export const domainEventKindsDeclaredTwice = (): string[] =>
  [...DOMAIN_EVENT_OWNERS]
    .filter(([, owners]) => owners.length > 1)
    .map(([kind, owners]) => `${kind}: ${owners.join(', ')}`);
