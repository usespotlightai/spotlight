import { EventSubscribers } from '@platform/events/event-subscribers';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import { describe, expect, it } from 'vitest';

const heard = () => Promise.resolve([]);

const subscribers = new EventSubscribers();
subscribers.register([
  subscribing('test.exact', ['task.opened', 'work.task-opened.v1'], heard),
]);
subscribers.registerSink({
  subscriber: subscribing('test.work', [], heard),
  prefixes: ['work.'],
  retry: null,
});
subscribers.registerSink({
  subscriber: subscribing('test.every', [], heard),
  prefixes: [''],
  retry: null,
});

const listening = (kind: string) =>
  subscribers.subscribersHearing(kind).map((each) => each.name);

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
      more.registerSink({
        subscriber: subscribing('test.part', [], heard),
        prefixes: ['identity.workspace'],
        retry: null,
      }),
    ).toThrow('test.part hears identity.workspace, which is not a context');
    expect(more.named('test.part')).toBeNull();
  });

  it('refuses a sink that names a domain event kind, so no domain event is sent out', () => {
    const more = new EventSubscribers();

    expect(() =>
      more.registerSink({
        subscriber: subscribing('test.leak', ['task.opened'], heard),
        prefixes: [],
        retry: null,
      }),
    ).toThrow(
      'test.leak hears task.opened, which is not an integration event kind',
    );
    expect(more.named('test.leak')).toBeNull();
  });

  it('keeps the retry of a sink, and leaves another subscriber to the outbox default', () => {
    const retry = Retry.backoff({
      maxAttempts: 3,
      initialDelayMs: 1_000,
      maxDelayMs: 1_000,
    });
    const more = new EventSubscribers();
    more.registerSink({
      subscriber: subscribing('test.sink', [], heard),
      prefixes: [''],
      retry,
    });

    expect(more.retryOf('test.sink')).toBe(retry);
    expect(subscribers.retryOf('test.work')).toBeNull();
    expect(subscribers.retryOf('test.exact')).toBeNull();
  });

  it('answers whether a subscriber of the name is registered and hears the kind', () => {
    expect(subscribers.hears('test.work', 'work.task-opened.v1')).toBe(true);
    expect(subscribers.hears('test.work', 'runs.run-ended.v1')).toBe(false);
    expect(subscribers.hears('test.gone', 'task.opened')).toBe(false);
  });

  it('puts the sinks in the sinks lane, and the other subscribers in the contexts lane', () => {
    expect(subscribers.lane('sinks')).toEqual([
      { name: 'test.work', kinds: [], prefixes: ['work.'] },
      { name: 'test.every', kinds: [], prefixes: [''] },
    ]);
    expect(subscribers.lane('contexts')).toEqual([
      {
        name: 'test.exact',
        kinds: ['task.opened', 'work.task-opened.v1'],
        prefixes: [],
      },
    ]);
    expect(subscribers.isSink('test.work')).toBe(true);
    expect(subscribers.isSink('test.exact')).toBe(false);
  });
});
