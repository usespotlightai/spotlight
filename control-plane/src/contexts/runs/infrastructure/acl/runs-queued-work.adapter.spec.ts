import { RunsQueuedWork } from '@runs/infrastructure/acl/runs-queued-work.adapter';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T20:30:00.000Z');

describe('RunsQueuedWork', () => {
  it('says work waits while a run of the workspace waits for any runner', async () => {
    const asked: unknown[] = [];
    const queued = (placements: readonly RunnerPlacement[]) =>
      new RunsQueuedWork({
        unclaimedIn: async (workspaceId, now) => {
          asked.push([workspaceId.value, now]);
          return placements;
        },
      });

    await expect(
      queued([RunnerPlacement.ofLabelGroups([], null)]).waitsIn(
        WorkspaceId.of('ws_1'),
        NOW,
      ),
    ).resolves.toBe(true);
    await expect(queued([]).waitsIn(WorkspaceId.of('ws_1'), NOW)).resolves.toBe(
      false,
    );
    expect(asked).toEqual([
      ['ws_1', NOW],
      ['ws_1', NOW],
    ]);
  });
});
