import { RunsQueuedWork } from '@runs/infrastructure/acl/runs-queued-work.adapter';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T20:30:00.000Z');

const WORKSPACE = WorkspaceId.of('ws_1');

describe('RunsQueuedWork', () => {
  it('says work waits only while a run of the workspace waits that a runner with the labels could take', async () => {
    const asked: unknown[] = [];
    const queued = new RunsQueuedWork({
      unclaimedIn: async (workspaceId, now) => {
        asked.push([workspaceId.value, now]);
        return [RunnerPlacement.of(['gpu'])];
      },
    });

    await expect(
      queued.waitsFor(WORKSPACE, ['gpu', 'linux'], NOW),
    ).resolves.toBe(true);
    await expect(queued.waitsFor(WORKSPACE, ['linux'], NOW)).resolves.toBe(
      false,
    );
    expect(asked).toEqual([
      ['ws_1', NOW],
      ['ws_1', NOW],
    ]);
  });
});
