import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  domainEventKindsDeclaredTwice,
  eventSubscriptionsIn,
  eventSubscriptionViolations,
} from './event-subscriptions';
import { KNOWN_EVENT_SUBSCRIPTIONS } from './event-subscriptions.known';
import { ratchetProblems } from './known-violations';

const PATH = 'contexts/memory/presentation/events/fixture.ts';
const SUBSCRIBER =
  '@shared-kernel/application/ports/domain-event-subscriber.port';

const problemsIn = (source: string): string[] =>
  eventSubscriptionsIn({
    path: PATH,
    tree: ts.createSourceFile(PATH, source, ts.ScriptTarget.Latest, true),
  }).map((violation) => violation.key.replace(`${PATH}: `, ''));

describe('event subscriptions', () => {
  it('accepts an own domain event and an upstream integration event', () => {
    expect(
      problemsIn(`import { subscribing } from '${SUBSCRIBER}';
        import { TASK_DELETED } from '@shared-kernel/application/integration-events/task-deleted.integration-event';
        const OWN = ['memory.used'];
        subscribing('memory.a', OWN, handle);
        subscribing('memory.b', [TASK_DELETED], handle);`),
    ).toEqual([]);
  });

  it('finds a subscriber built by hand and a kind it cannot resolve', () => {
    expect(
      problemsIn(`import { subscribing } from '${SUBSCRIBER}';
        subscribing('memory.a', ['memory.used', dynamicKind()], handle);
        const custom = { name: 'memory.b', kinds: ['memory.used'], handle };`),
    ).toEqual([
      'memory.a hears dynamicKind(), which the check cannot resolve',
      'builds a subscriber without subscribing or projecting',
    ]);
  });

  it('finds another context domain event heard by its kind', () => {
    expect(
      problemsIn(`import { subscribing } from '${SUBSCRIBER}';
        subscribing('memory.a', ['task.opened'], handle);`),
    ).toEqual(['memory.a hears the domain event task.opened of work']);
  });

  it('finds an integration event named by string', () => {
    expect(
      problemsIn(`import { subscribing } from '${SUBSCRIBER}';
        subscribing('memory.a', ['work.task-deleted.v1'], handle);`),
    ).toEqual([
      'memory.a names the integration event work.task-deleted.v1 by string',
    ]);
  });

  it('finds a downstream integration event behind a constant', () => {
    expect(
      problemsIn(`import { subscribing } from '${SUBSCRIBER}';
        import { STATION_ALERT_FIRED } from '@shared-kernel/application/integration-events/station-alert-fired.integration-event';
        const HEARD = { fired: STATION_ALERT_FIRED };
        subscribing('memory.a', [HEARD.fired], handle);`),
    ).toEqual([
      'memory.a hears insights.station-alert-fired.v1 of insights, which is not upstream',
    ]);
  });

  it('finds a projection of another context domain event', () => {
    expect(
      problemsIn(`import { projecting } from '@shared-kernel/application/ports/event-projection.port';
        const opened = (event) => event.kind === 'task.opened';
        projecting('memory.a', opened, project);`),
    ).toEqual(['memory.a hears the domain event task.opened of work']);
  });

  it('gives every domain event kind one owning context', () => {
    expect(domainEventKindsDeclaredTwice()).toEqual([]);
  });

  it('hears only its own domain events and upstream integration events', () => {
    expect(
      ratchetProblems(eventSubscriptionViolations(), KNOWN_EVENT_SUBSCRIPTIONS),
    ).toEqual([]);
  }, 60_000);
});
