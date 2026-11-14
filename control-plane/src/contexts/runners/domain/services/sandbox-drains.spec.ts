import { aHost } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { aSandbox } from '@runners/domain/aggregates/sandbox.fake-spec';
import { sandboxesToDrainOn } from '@runners/domain/services/sandbox-drains';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-30T10:00:00.000Z');

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const onHost = (id: string, key: string) =>
  aSandbox({
    id,
    key,
    workspaceId: WorkspaceId.of('ws_1'),
    hostId: HOST,
    at: AT,
  });

describe('sandboxesToDrainOn', () => {
  it('drains what the host reports but does not keep: drained, unknown, or idle on a stopping host', () => {
    const host = aHost({
      id: HOST,
      at: AT,
      sandboxes: ['sandbox_1', 'sandbox_2', 'sandbox_9'],
    });
    const live = [
      onHost('sandbox_1', 'task-task_1'),
      onHost('sandbox_2', 'task-task_2').drain(),
    ];

    expect(
      sandboxesToDrainOn(host, live, AT).map((each) => each.value),
    ).toEqual(['sandbox_2', 'sandbox_9']);
  });

  it('drains an idle sandbox once its host is stopping, and keeps a busy one', () => {
    const host = aHost({
      id: HOST,
      at: AT,
      sandboxes: ['sandbox_1', 'sandbox_2'],
      stopping: true,
    });
    const live = [
      onHost('sandbox_1', 'task-task_1').releaseRun(RunId.of('run_1'), AT),
      onHost('sandbox_2', 'task-task_2'),
    ];

    expect(
      sandboxesToDrainOn(host, live, AT).map((each) => each.value),
    ).toEqual(['sandbox_1']);
  });
});
