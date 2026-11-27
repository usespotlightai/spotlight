import type { RunFacts } from '@runs/application/ports/run-facts.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import type { TaskRunFacts } from '@work/application/ports/trial-facts.port';
import { TrialableRuns } from '@work/application/services/trialable-runs.service';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { describe, expect, it } from 'vitest';

const BUILD = StationId.of('station_build');
const COMMIT = 'a'.repeat(40);

const station = (
  id: string,
  key: string,
  position: number,
  kind?: 'backlog' | 'completed',
) =>
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: '#a3a8b0',
    ...(kind ? { kind } : {}),
  });

const lineWith = (...repositories: readonly string[]) =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    repositories: repositories.map((each) => repositoryOf(Repository.of(each))),
    stations: [
      station('station_backlog', 'backlog', 0, 'backlog'),
      station(BUILD.value, 'build', 1),
      station('station_completed', 'completed', 2, 'completed'),
    ],
  });

const factsOf = (paths: readonly string[]): RunFacts =>
  partial<RunFacts>({
    runId: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    ended: true,
    startedFrom: {
      archiveId: null,
      archiveStored: false,
      at: new Date('2026-11-11T09:00:00.000Z'),
      checkouts: paths.map((path) => ({ path, commit: COMMIT })),
    },
  });

const RAN: TaskRunFacts = {
  runId: 'run_1',
  taskId: 'task_1',
  stationId: BUILD.value,
  briefed: true,
  reviewing: null,
  taskExists: true,
  title: 'Drain the queue',
};

const summaryOf = async (
  facts: RunFacts,
  line: ReturnType<typeof lineWith> | null,
  ran: TaskRunFacts = RAN,
) => {
  const [summary] = await new TrialableRuns(
    { of: async () => [facts] },
    { ofTaskRuns: async () => new Map([[ran.runId, ran]]) },
    partial<StationRunReaderPort>({}),
    partial<LineMapsPort>({
      findByStation: async (station: StationId) =>
        station.equals(BUILD) ? line : null,
    }),
  ).summaries('ws_1', ['run_1']);

  return summary;
};

describe('TrialableRuns', () => {
  it('finds a run trialable when it checked out every repository the line has now', async () => {
    await expect(
      summaryOf(factsOf(['api', 'web']), lineWith('acme/api', 'acme/web')),
    ).resolves.toMatchObject({ untrialableReason: null, description: null });
  });

  it('leaves out a run that ran without a repository the line has now, such as one from before the line had any', async () => {
    await expect(
      summaryOf(factsOf([]), lineWith('acme/api')),
    ).resolves.toMatchObject({
      untrialableReason: 'repository-missing',
      description:
        'It ran without repository acme/api, which the line has now.',
    });
    await expect(
      summaryOf(factsOf(['api']), lineWith('acme/api', 'acme/web')),
    ).resolves.toMatchObject({ untrialableReason: 'repository-missing' });
  });

  it('leaves out a run that checked out a repository the line no longer has', async () => {
    await expect(
      summaryOf(factsOf(['api', 'web']), lineWith('acme/api')),
    ).resolves.toMatchObject({ untrialableReason: 'repository-gone' });
  });

  it('compares a review run only with the repository it reviewed', async () => {
    await expect(
      summaryOf(factsOf(['web']), lineWith('acme/api', 'acme/web'), {
        ...RAN,
        reviewing: 'acme/web',
      }),
    ).resolves.toMatchObject({ untrialableReason: null });
  });
});
