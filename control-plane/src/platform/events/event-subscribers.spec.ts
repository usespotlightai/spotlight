import { EventSubscribers } from '@platform/events/event-subscribers';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { describe, expect, it } from 'vitest';

const heard = async () => [];

const subscribers = new EventSubscribers();
subscribers.register([
  subscribing('test.exact', ['task.opened', 'work.task-opened.v1'], heard),
]);
subscribers.registerSink(subscribing('test.work', [], heard), {
  prefixes: ['work.'],
});
subscribers.registerSink(subscribing('test.every', [], heard), {
  prefixes: [''],
});

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
      more.registerSink(subscribing('test.part', [], heard), {
        prefixes: ['identity.workspace'],
      }),
    ).toThrow('test.part hears identity.workspace, which is not a context');
    expect(more.named('test.part')).toBeNull();
  });

  it('leaves the retry of a subscriber made with subscribing to the outbox default', () => {
    expect(subscribers.named('test.exact')?.retry).toBeUndefined();
  });

  it('answers whether a subscriber of the name is registered and hears the kind', () => {
    expect(subscribers.hears('test.work', 'work.task-opened.v1')).toBe(true);
    expect(subscribers.hears('test.work', 'runs.run-ended.v1')).toBe(false);
    expect(subscribers.hears('test.gone', 'task.opened')).toBe(false);
  });

  it('names the sinks, which go in a lane of their own', () => {
    expect(subscribers.sinks()).toEqual(['test.work', 'test.every']);
  });
});
