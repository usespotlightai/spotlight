import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { HeldRun, WorkPort } from '@memory/application/ports/work.port';
import { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

const held = (replay: boolean): HeldRun => ({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  taskId: null,
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [],
  replaysFrom: replay ? NOW : null,
});

const atHand = () => {
  const recorded: string[][] = [];
  const hand = new RunnerMemoryAtHand(
    {} as unknown as WorkPort,
    {
      record: async (_run: RunId, _way: string, memories: MemoryId[]) => {
        recorded.push(memories.map((each) => each.value));
      },
    } as unknown as MemoryUsesPort,
    { now: () => NOW, sleep: async () => {} },
  );

  return { hand, recorded };
};

describe('memories a runner recalls', () => {
  it('count as used by the run that recalled them', async () => {
    const { hand, recorded } = atHand();

    await hand.recalled(held(false), [MemoryId.of('memory_1')]);

    expect(recorded).toEqual([['memory_1']]);
  });

  it('count as used by nothing when a replay recalls them', async () => {
    const { hand, recorded } = atHand();

    await hand.recalled(held(true), [MemoryId.of('memory_1')]);

    expect(recorded).toEqual([]);
  });
});
