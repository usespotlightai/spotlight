import { RunsQueuedWork } from '@runs/infrastructure/acl/runs-queued-work.adapter';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T20:30:00.000Z');

const WORKSPACE = WorkspaceId.of('ws_1');

describe('RunsQueuedWork', () => {
  it('reads the queue of the workspace once, and says for each set of labels whether a runner with them could take a waiting run', async () => {
    const asked: unknown[] = [];
    const queued = new RunsQueuedWork({
      unclaimedIn: async (workspaceId, now) => {
        asked.push([workspaceId.value, now]);
        return [RunnerPlacement.of(['gpu'])];
      },
    });

    const waiting = await queued.waitingIn(WORKSPACE, NOW);

    expect(waiting.couldBeTakenWith(['gpu', 'linux'])).toBe(true);
    expect(waiting.couldBeTakenWith(['linux'])).toBe(false);
    expect(asked).toEqual([['ws_1', NOW]]);
  });
});
