import { RUNNERS_PUBLICATIONS } from '@runners/application/integration-events/runners.publications';
import {
  aPullPool,
  aPushPool,
  aTrust,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

const published = (events: readonly DomainEvent[]) =>
  events.flatMap((event) =>
    RUNNERS_PUBLICATIONS.filter((each) => each.from === event.kind).map(
      (each) => each.publish(event),
    ),
  );

const WAY_IN_OPENED = [
  { kind: 'runners.way-in-opened.v1', workspaceId: 'ws_1' },
];

describe('RUNNERS_PUBLICATIONS', () => {
  it('publishes a defined pool as a way in opened to its workspace, whether it pulls or provisions', () => {
    expect(published(aPullPool().pullEvents())).toEqual(WAY_IN_OPENED);
    expect(published(aPushPool().pullEvents())).toEqual(WAY_IN_OPENED);
  });

  it('publishes a defined trust as a way in opened to its workspace', () => {
    expect(published(aTrust().pullEvents())).toEqual(WAY_IN_OPENED);
  });

  it('publishes nothing when a pool is retired or a trust withdrawn', () => {
    const retired = aPullPool();
    retired.pullEvents();
    const withdrawn = aTrust();
    withdrawn.pullEvents();

    const ended = [
      ...retired.retired(attributedIn()).pullEvents(),
      ...withdrawn.withdrawn(attributedIn()).pullEvents(),
    ];

    expect(ended.map((event) => event.kind)).toEqual([
      'runner-pool.retired',
      'runner-trust.withdrawn',
    ]);
    expect(published(ended)).toEqual([]);
  });
});
