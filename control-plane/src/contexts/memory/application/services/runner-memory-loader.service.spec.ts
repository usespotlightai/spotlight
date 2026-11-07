import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { NotAllowedInIsolatedRunError } from '@memory/domain/exceptions/not-allowed-in-isolated-run.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const leasedRun = (isolated: boolean): LeasedRun => ({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  taskId: null,
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  repositories: [],
  asOf: null,
  isolated,
  trial: false,
});

const loader = (run: LeasedRun) =>
  new RunnerMemoryLoader({ leasedBy: async () => run } as unknown as WorkPort);

describe('a run that recalls memories', () => {
  it('is not allowed in a search, which may not recall them at all', async () => {
    await expect(
      loader(leasedRun(true)).recalling(
        RunId.of('run_1'),
        RunnerId.of('runner_1'),
      ),
    ).rejects.toThrow(NotAllowedInIsolatedRunError);
    await expect(
      loader(leasedRun(false)).recalling(
        RunId.of('run_1'),
        RunnerId.of('runner_1'),
      ),
    ).resolves.toMatchObject({ isolated: false, trial: false });
  });
});
