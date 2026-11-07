import ts from 'typescript';
import {
  CONTEXTS,
  contextOf,
  descendants,
  moduleSpecifiersOf,
  moduleTarget,
  sourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';
import type { Violation } from './violation';

export const UPSTREAM_CONTEXTS: Readonly<Record<string, readonly string[]>> = {
  identity: [],
  secrets: ['identity'],
  catalog: ['identity'],
  github: ['identity'],
  runners: ['identity', 'secrets'],
  lines: ['identity', 'catalog'],
  runs: ['identity', 'secrets', 'runners', 'lines'],
  work: ['catalog', 'github', 'runners', 'lines', 'runs'],
  configuration: ['work'],
  'change-review': ['work'],
  memory: ['work', 'lines'],
  insights: ['change-review', 'memory', 'configuration'],
  replays: ['change-review', 'insights', 'configuration'],
  integrations: ['configuration'],
};

export const reachableFrom = (context: string): ReadonlySet<string> => {
  const reached = new Set<string>();
  const pending = [...(UPSTREAM_CONTEXTS[context] ?? [])];

  while (pending.length > 0) {
    const next = pending.pop() as string;

    if (!reached.has(next)) {
      reached.add(next);
      pending.push(...(UPSTREAM_CONTEXTS[next] ?? []));
    }
  }

  return reached;
};

const INTEGRATION_EVENTS = 'shared-kernel/application/integration-events/';
const INTEGRATION_EVENT_KIND = /^([a-z-]+)\.[a-z-]+\.v\d+$/;

const publisherOf = (module: string): string | null => {
  const kinds = descendants(
    sourceFile(`${module}.ts`).tree,
    ts.isStringLiteral,
  ).flatMap((literal) => {
    const context = INTEGRATION_EVENT_KIND.exec(literal.text)?.[1];

    return context && CONTEXTS.includes(context) ? [context] : [];
  });

  return kinds[0] ?? null;
};

type ContextDependency = {
  readonly from: string;
  readonly to: string;
  readonly through: 'import' | 'integration event';
  readonly file: string;
};

const contextDependencies = (): ContextDependency[] =>
  sourceFiles('contexts', { specs: true }).flatMap((file) => {
    const from = contextOf(file.path) as string;

    return moduleSpecifiersOf(file).flatMap(
      (specifier): ContextDependency[] => {
        const target = moduleTarget(file.path, specifier);
        const to = target ? contextOf(target) : null;

        if (to && to !== from) {
          return [{ from, to, through: 'import', file: file.path }];
        }

        if (
          target?.startsWith(INTEGRATION_EVENTS) &&
          target !== `${INTEGRATION_EVENTS}integration-event`
        ) {
          const publisher = publisherOf(target);

          return publisher && publisher !== from
            ? [
                {
                  from,
                  to: publisher,
                  through: 'integration event',
                  file: file.path,
                },
              ]
            : [];
        }

        return [];
      },
    );
  });

export const contextDependencyViolations = (): Violation[] =>
  contextDependencies()
    .filter((dependency) => !reachableFrom(dependency.from).has(dependency.to))
    .map((dependency) => ({
      key: `${dependency.from} depends on ${dependency.to} through ${dependency.through}`,
      at: dependency.file,
    }));

export const integrationEventsWithoutPublisher = (): string[] =>
  sourceFiles(INTEGRATION_EVENTS)
    .map((file) => withoutExtension(file.path))
    .filter(
      (module) =>
        module !== `${INTEGRATION_EVENTS}integration-event` &&
        publisherOf(module) === null,
    );
