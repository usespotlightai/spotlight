import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  domainEventConstructionsIn,
  domainEventConstructionViolations,
} from './domain-event-construction';
import { KNOWN_DOMAIN_EVENT_CONSTRUCTION } from './domain-event-construction.known';
import { ratchetProblems } from './known-violations';

const EVENT = '@work/domain/events/task-opened.event';

const builtIn = (path: string, source: string): string[] =>
  domainEventConstructionsIn({
    path,
    tree: ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true),
  }).map((violation) => violation.key.replace(/^[^:]+: /, ''));

describe('domain event construction', () => {
  it('lets an aggregate build its events', () => {
    expect(
      builtIn(
        'contexts/work/domain/aggregates/fixture.aggregate.ts',
        `import { TaskOpened } from '${EVENT}'; new TaskOpened();`,
      ),
    ).toEqual([]);
  });

  it('finds an event built by a domain service', () => {
    expect(
      builtIn(
        'contexts/work/domain/services/fixture.ts',
        `import { TaskOpened } from '${EVENT}'; new TaskOpened();`,
      ),
    ).toEqual(['new TaskOpened']);
  });

  it('finds an event built through a namespace import or a factory', () => {
    expect(
      builtIn(
        'contexts/work/application/services/fixture.ts',
        `import * as events from '${EVENT}';
         import { TaskOpened } from '${EVENT}';
         new events.TaskOpened();
         TaskOpened.of();`,
      ),
    ).toEqual(['new events.TaskOpened', 'TaskOpened.of()']);
  });

  it('raises domain events only in aggregates and their entities', () => {
    expect(
      ratchetProblems(
        domainEventConstructionViolations(),
        KNOWN_DOMAIN_EVENT_CONSTRUCTION,
      ),
    ).toEqual([]);
  }, 60_000);
});
