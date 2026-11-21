import { EventSubscribers } from '@platform/events/event-subscribers';
import {
  DEFAULT_RETRY,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { describe, expect, it } from 'vitest';

const heard = async () => [];

const subscribers = new EventSubscribers();
subscribers.register([
  subscribing('test.exact', ['task.opened', 'work.task-opened.v1'], heard),
]);
subscribers.registerByPrefix(subscribing('test.work', [], heard), ['work.']);
subscribers.registerByPrefix(subscribing('test.every', [], heard), ['']);

const listening = (kind: string) =>
  subscribers.listeningTo(kind).map((each) => each.name);

describe('EventSubscribers', () => {
  it('matches a subscriber that names the kind', () => {
    expect(listening('task.opened')).toEqual(['test.exact']);
  });

  it('matches an integration event by its context, and the empty prefix matches every one', () => {
    expect(listening('work.task-opened.v1')).toEqual([
      'test.exact',
      'test.work',
      'test.every',
    ]);
    expect(listening('identity.workspace-created.v1')).toEqual(['test.every']);
  });

  it('never matches a domain event by a prefix', () => {
    expect(listening('work.reconciled')).toEqual([]);
    expect(listening('workspace.created')).toEqual([]);
  });

  it('refuses a prefix that is not a whole context', () => {
    const more = new EventSubscribers();

    expect(() =>
      more.registerByPrefix(subscribing('test.part', [], heard), [
        'identity.workspace',
      ]),
    ).toThrow('test.part hears identity.workspace, which is not a context');
    expect(more.names()).toEqual([]);
  });

  it('gives a subscriber made with subscribing the default retry', () => {
    expect(subscribers.named('test.exact')?.retry).toBe(DEFAULT_RETRY);
    expect(subscribers.names()).toEqual([
      'test.exact',
      'test.work',
      'test.every',
    ]);
  });
});
