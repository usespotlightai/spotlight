import { RUNNERS_EVENT_MAPPERS } from '@runners/application/integration-events/runners.event-mappers';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import {
  aPullPool,
  aPushPool,
  aTrust,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (events: readonly DomainEvent[]) =>
  events.flatMap((event) =>
    RUNNERS_EVENT_MAPPERS.filter((each) => each.from === event.kind).map(
      (each) => each.map(event, new Date()),
    ),
  );

const WAY_IN_OPENED = [
  { kind: 'runners.way-in-opened.v1', workspaceId: 'ws_1' },
];

describe('RUNNERS_EVENT_MAPPERS', () => {
  it('publishes a defined pool as a way in opened to its workspace, whether it pulls or provisions', () => {
    expect(published(aPullPool().pullEvents())).toEqual(WAY_IN_OPENED);
    expect(published(aPushPool().pullEvents())).toEqual(WAY_IN_OPENED);
  });

  it('publishes a defined trust as a way in opened to its workspace', () => {
    expect(published(aTrust().pullEvents())).toEqual(WAY_IN_OPENED);
  });

  it('publishes a host that starts serving a harness to its workspace', () => {
    const host = RunnerHost.fromHeartbeat({
      id: HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE'),
      workspaceId: WorkspaceId.of('ws_1'),
      admission: Admission.of('pool', 'pool_1'),
      bootId: BootId.of('boot_1'),
      report: HostReport.of({
        name: 'build-box',
        release: '0.9.0',
        containerRuntime: 'docker',
        capacity: 1,
        running: [],
        images: [
          {
            image: 'ghcr.io/usespotlightai/spotlight-runner:1.0.0',
            isDefault: true,
            harnesses: [{ id: 'claude-code', models: [] }],
          },
        ],
      }),
      at: new Date('2026-09-24T10:00:00.000Z'),
    });

    expect(published(host.pullEvents())).toEqual([
      { kind: 'runners.host-started-serving.v1', workspaceId: 'ws_1' },
    ]);
  });

  it('publishes nothing when a pool is retired or a trust withdrawn', () => {
    const retired = aPullPool();
    retired.pullEvents();
    const withdrawn = aTrust();
    withdrawn.pullEvents();

    const ended = [
      ...retired.retire(attributedIn()).pullEvents(),
      ...withdrawn.withdraw(attributedIn()).pullEvents(),
    ];

    expect(ended.map((event) => event.kind)).toEqual([
      'runner-pool.retired',
      'runner-trust.withdrawn',
    ]);
    expect(published(ended)).toEqual([]);
  });
});
