import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { HeldRun, WorkPort } from '@memory/application/ports/work.port';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import { KeptFromSearchesError } from '@memory/domain/exceptions/kept-from-searches.error';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

const held = (replay: boolean, isSearch = false): HeldRun => ({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  taskId: null,
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [],
  replaysFrom: replay ? NOW : null,
  isSearch,
});

const atHand = (holding: HeldRun = held(false)) => {
  const recorded: string[][] = [];
  const hand = new RunnerMemoryAtHand(
    { heldBy: async () => holding } as unknown as WorkPort,
    new RecordMemoryUses(
      {
        record: async (_run: RunId, _way: string, memories: MemoryId[]) => {
          recorded.push(memories.map((each) => each.value));
        },
      } as unknown as MemoryUsesPort,
      { dispatch: async () => {} },
      { run: (work) => work() },
      { now: () => NOW, sleep: async () => {} },
    ),
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

  it('are kept from a search, which may not recall them at all', async () => {
    await expect(
      atHand(held(false, true)).hand.recalling('run_1', 'runner_1'),
    ).rejects.toThrow(KeptFromSearchesError);
    await expect(
      atHand(held(false)).hand.recalling('run_1', 'runner_1'),
    ).resolves.toMatchObject({ isSearch: false });
  });
});
