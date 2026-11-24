import { RUNNERS_EVENT_MAPPERS } from '@runners/application/integration-events/runners.event-mappers';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import {
  aPlatformPool,
  aPullPool,
  aPushPool,
  aRunner,
  aTrust,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { SandboxReport } from '@runners/domain/value-objects/sandbox-report.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (events: readonly DomainEvent[]) =>
  events.flatMap((event) =>
    RUNNERS_EVENT_MAPPERS.filter((each) => each.from === event.kind).map(
      (each) => each.map(event, new Date()),
    ),
  );

const WAY_IN_OPENED = [
  { kind: 'runners.runner-access-created.v1', workspaceId: 'ws_1' },
];

describe('RUNNERS_EVENT_MAPPERS', () => {
  it('publishes runner access defined in its workspace for a created pool, whether it pulls or provisions', () => {
    expect(published(aPullPool().pullEvents())).toEqual(WAY_IN_OPENED);
    expect(published(aPushPool().pullEvents())).toEqual(WAY_IN_OPENED);
  });

  it('publishes runner access defined in its workspace for a created trust', () => {
    expect(published(aTrust().pullEvents())).toEqual(WAY_IN_OPENED);
  });

  it('publishes a host that becomes ready to its workspace', () => {
    const host = RunnerHost.fromHeartbeat({
      id: HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE'),
      workspaceId: WorkspaceId.of('ws_1'),
      source: CredentialSource.of('pool', 'pool_1'),
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
      sandboxes: SandboxReport.of({ sandboxes: [], stopping: false }),
      at: new Date('2026-09-24T10:00:00.000Z'),
    });

    expect(published(host.pullEvents())).toEqual([
      { kind: 'runners.host-became-ready.v1', workspaceId: 'ws_1' },
    ]);
  });

  it('publishes nothing when a pool or a trust is deleted', () => {
    const pool = aPullPool();
    pool.pullEvents();
    const trust = aTrust();
    trust.pullEvents();

    const ended = [
      ...pool.delete(changeActorIn()).pullEvents(),
      ...trust.delete(changeActorIn()).pullEvents(),
    ];

    expect(ended.map((event) => event.kind)).toEqual([
      'runner-pool.deleted',
      'runner-trust.deleted',
    ]);
    expect(published(ended)).toEqual([]);
  });
  it('publishes a runner that ended, with its pool, whether it is the platform pool, its work and its times', () => {
    const ended = aRunner({ through: aPlatformPool(), host: null })
      .claim(RunnerWork.check('stack_1'), new Date('2026-09-24T10:00:30.000Z'))
      .ended(new Date('2026-09-24T10:05:00.000Z'));

    expect(published(ended.pullEvents())).toEqual([
      {
        kind: 'runners.runner-ended.v1',
        runnerId: 'pooled_1',
        workspaceId: 'ws_1',
        poolId: 'pool_platform',
        trustId: null,
        platform: true,
        work: { kind: 'check', id: 'stack_1' },
        startedAt: '2026-09-24T10:00:00.000Z',
        claimedAt: '2026-09-24T10:00:30.000Z',
        endedAt: '2026-09-24T10:05:00.000Z',
        ending: 'finished',
      },
    ]);
  });

  it('publishes a runner released before it claimed work with no work and no claim time', () => {
    const released = aRunner({ through: aTrust() }).release(
      new Date('2026-09-24T10:01:00.000Z'),
    );

    expect(published(released.pullEvents())).toEqual([
      expect.objectContaining({
        poolId: null,
        trustId: 'trust_1',
        platform: false,
        work: null,
        claimedAt: null,
        ending: 'released',
      }),
    ]);
  });
});
