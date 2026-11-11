import ts from 'typescript';
import { DECLARED_EVENTS, isDomainEventsPath } from './domain-event-kinds';
import {
  descendants,
  importsOf,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';
import type { Violation } from './violation';

const RECORDING_LAYERS =
  /^contexts\/[^/]+\/domain\/(aggregates|entities|events)\//;

const EVENT_CLASSES: ReadonlyMap<
  string,
  ReadonlySet<string>
> = DECLARED_EVENTS.filter((event) =>
  isDomainEventsPath(event.file.path),
).reduce((byModule, event) => {
  const module = withoutExtension(event.file.path);
  byModule.set(module, new Set([...(byModule.get(module) ?? []), event.name]));

  return byModule;
}, new Map<string, Set<string>>());

const unwrapped = (expression: ts.Expression): ts.Expression => {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }

  return current;
};

const eventReferencesOf = (file: SourceFile): ReadonlySet<string> =>
  new Set(
    importsOf(file).flatMap((imported) => {
      const classes = EVENT_CLASSES.get(imported.target);

      if (!classes) {
        return [];
      }

      return imported.exported === '*'
        ? [...classes].map((name) => `${imported.local}.${name}`)
        : classes.has(imported.exported)
          ? [imported.local]
          : [];
    }),
  );

const builtEvent = (
  node: ts.Node,
  events: ReadonlySet<string>,
): string | null => {
  if (ts.isNewExpression(node)) {
    const name = unwrapped(node.expression).getText();

    return events.has(name) ? `new ${name}` : null;
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
  ) {
    const owner = unwrapped(node.expression.expression).getText();

    return events.has(owner) ? `${owner}.${node.expression.name.text}()` : null;
  }

  return null;
};

const constructionsIn = (file: SourceFile): Violation[] => {
  if (RECORDING_LAYERS.test(file.path)) {
    return [];
  }

  const events = eventReferencesOf(file);

  if (events.size === 0) {
    return [];
  }

  return descendants(
    file.tree,
    (node): node is ts.NewExpression | ts.CallExpression =>
      ts.isNewExpression(node) || ts.isCallExpression(node),
  ).flatMap((node) => {
    const built = builtEvent(node, events);

    return built
      ? [
          {
            key: `${withoutExtension(file.path)}: ${built}`,
            at: `${file.path}:${file.tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
          },
        ]
      : [];
  });
};

const misplacedEvents = (): Violation[] =>
  DECLARED_EVENTS.filter((event) => !isDomainEventsPath(event.file.path)).map(
    (event) => ({
      key: `${withoutExtension(event.file.path)}: ${event.name} is a domain event outside domain/events`,
      at: `${event.file.path}:${event.line}`,
    }),
  );

export const domainEventConstructionsIn = constructionsIn;

export const domainEventConstructionViolations = (): Violation[] => [
  ...sourceFiles('contexts').flatMap(constructionsIn),
  ...misplacedEvents(),
];
