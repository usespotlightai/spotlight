import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { NotAllowedInSearchError } from '@memory/domain/exceptions/not-allowed-in-search.error';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

const leasedRun = (replay: boolean, isSearch = false): LeasedRun => ({
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

const loader = (run: LeasedRun = leasedRun(false)) => {
  const recorded: string[][] = [];
  const hand = new RunnerMemoryLoader(
    { leasedBy: async () => run } as unknown as WorkPort,
    new RecordMemoryUses(
      {
        record: async (_run: RunId, _way: string, memories: MemoryId[]) => {
          recorded.push(memories.map((each) => each.value));
        },
      } as unknown as MemoryUsesPort,
      { dispatch: async () => {} },
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => {} },
    ),
  );

  return { hand, recorded };
};

describe('memories a runner recalls', () => {
  it('count as used by the run that recalled them', async () => {
    const { hand, recorded } = loader();

    await hand.recalled(leasedRun(false), [MemoryId.of('memory_1')]);

    expect(recorded).toEqual([['memory_1']]);
  });

  it('count as used by nothing when a replay recalls them', async () => {
    const { hand, recorded } = loader();

    await hand.recalled(leasedRun(true), [MemoryId.of('memory_1')]);

    expect(recorded).toEqual([]);
  });

  it('are not allowed in a search, which may not recall them at all', async () => {
    await expect(
      loader(leasedRun(false, true)).hand.recalling('run_1', 'runner_1'),
    ).rejects.toThrow(NotAllowedInSearchError);
    await expect(
      loader(leasedRun(false)).hand.recalling('run_1', 'runner_1'),
    ).resolves.toMatchObject({ isSearch: false });
  });
});
