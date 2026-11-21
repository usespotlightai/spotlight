import { EventSubscribers } from '@platform/events/event-subscribers';
import {
  DEFAULT_RETRIES,
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { describe, expect, it } from 'vitest';

const prefixed = (
  name: string,
  integrationEventPrefixes: readonly string[],
): DomainEventSubscriber => ({
  name,
  kinds: [],
  integrationEventPrefixes,
  callsOut: false,
  retries: DEFAULT_RETRIES,
  handle: async () => [],
});

const subscribers = new EventSubscribers();
subscribers.register([
  subscribing(
    'test.exact',
    ['task.opened', 'work.task-opened.v1'],
    async () => [],
  ),
  prefixed('test.work', ['work.']),
  prefixed('test.every', ['']),
]);

const heard = (kind: string) =>
  subscribers.listeningTo(kind).map((each) => each.name);

describe('EventSubscribers', () => {
  it('matches a subscriber that names the kind', () => {
    expect(heard('task.opened')).toEqual(['test.exact']);
  });

  it('matches an integration event by the start of its kind, and an empty prefix matches every one', () => {
    expect(heard('work.task-opened.v1')).toEqual([
      'test.exact',
      'test.work',
      'test.every',
    ]);
    expect(heard('identity.workspace-created.v1')).toEqual(['test.every']);
  });

  it('never matches a domain event by a prefix', () => {
    expect(heard('work.reconciled')).toEqual([]);
    expect(heard('workspace.created')).toEqual([]);
  });

  it('gives a subscriber made with subscribing no prefixes and the default retries', () => {
    expect(subscribers.named('test.exact')).toMatchObject({
      integrationEventPrefixes: [],
      retries: DEFAULT_RETRIES,
    });
  });
});
