import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type {
  RunFactsPort,
  RunSubjectFacts,
} from '@work/application/ports/run-facts.port';
import type { RunLeasesPort } from '@work/application/ports/run-leases.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import { RunWorks } from '@work/application/services/run-works.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const API = Repository.of('acme/api');

const works = (subject: RunSubjectFacts | null, found = true) =>
  new RunWorks(
    {} as RunLeasesPort,
    {
      of: async () => (found ? [{ workspaceId: WORKSPACE, subject }] : []),
    } as unknown as RunFactsPort,
    {} as RunsPort,
    {
      findById: async () => ({
        replayedRepository: (name: string) => (name === 'api' ? API : null),
      }),
    } as unknown as RunRepository,
    {} as TaskRepository,
    {} as ChatRepository,
    {
      findByStation: async () => {
        throw new Error('a replay names its repositories itself');
      },
    } as unknown as LineMapsPort,
    {} as BriefedTasksPort,
    { now: () => new Date(), sleep: async () => {} },
  );

describe('RunWorks, finding the repository a run’s change is checked in', () => {
  it('finds a replay’s repository from what it replays, even once its station is gone', async () => {
    const replay: RunSubjectFacts = {
      kind: 'replay',
      replayOf: RunId.of('run_0'),
      taskId: TaskId.of('task_1'),
      stationId: null,
      teamId: TeamId.of('team_1'),
    };

    expect(
      await works(replay).repositoryForCheck(RunId.of('run_1'), 'api'),
    ).toEqual({ workspaceId: WORKSPACE, repository: API });
    expect(
      await works(replay).repositoryForCheck(RunId.of('run_1'), 'web'),
    ).toBeNull();
  });

  it('finds nothing for a search, which changes no repository', async () => {
    const search: RunSubjectFacts = {
      kind: 'search',
      searchId: 'search_1',
      iteration: 1,
      stationId: StationId.of('station_1'),
      teamId: TeamId.of('team_1'),
    };

    expect(
      await works(search).repositoryForCheck(RunId.of('run_1'), 'api'),
    ).toBeNull();
  });

  it('finds nothing for a run there is none of', async () => {
    expect(
      await works(null, false).repositoryForCheck(RunId.of('run_1'), 'api'),
    ).toBeNull();
  });
});
