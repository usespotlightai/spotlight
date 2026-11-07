import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { NotAllowedInSearchError } from '@memory/domain/exceptions/not-allowed-in-search.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const leasedRun = (isSearch: boolean): LeasedRun => ({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  taskId: null,
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  repositories: [],
  replaysFrom: null,
  isSearch,
});

const loader = (run: LeasedRun) =>
  new RunnerMemoryLoader({ leasedBy: async () => run } as unknown as WorkPort);

describe('a run that recalls memories', () => {
  it('is not allowed in a search, which may not recall them at all', async () => {
    await expect(
      loader(leasedRun(true)).recalling('run_1', 'runner_1'),
    ).rejects.toThrow(NotAllowedInSearchError);
    await expect(
      loader(leasedRun(false)).recalling('run_1', 'runner_1'),
    ).resolves.toMatchObject({ isSearch: false });
  });
});
