import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import { RunWorks } from '@work/application/services/run-works.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const API = Repository.of('acme/api');

const works = (run: object | null) =>
  new RunWorks(
    { findById: async () => run } as unknown as RunRepository,
    {} as TaskRepository,
    {} as ChatRepository,
    {
      findByStation: async () => {
        throw new Error('a replay names its repositories itself');
      },
    } as unknown as LineRepository,
    {} as BriefedTasksPort,
    { now: () => new Date(), sleep: async () => {} },
  );

describe('RunWorks, finding the repository a run’s change is checked in', () => {
  it('finds a replay’s repository from what it replays, even once its station is gone', async () => {
    const replay = {
      workspaceId: WORKSPACE,
      stationId: null,
      isReplay: true,
      replayedRepository: (name: string) => (name === 'api' ? API : null),
    };

    expect(
      await works(replay).repositoryForCheck(RunId.of('run_1'), 'api'),
    ).toEqual({ workspaceId: WORKSPACE, repository: API });
    expect(
      await works(replay).repositoryForCheck(RunId.of('run_1'), 'web'),
    ).toBeNull();
  });

  it('finds nothing for a search, which changes no repository', async () => {
    const search = {
      workspaceId: WORKSPACE,
      stationId: { value: 'station_1' },
      isReplay: false,
      isSearch: true,
    };

    expect(
      await works(search).repositoryForCheck(RunId.of('run_1'), 'api'),
    ).toBeNull();
  });

  it('finds nothing for a run there is none of', async () => {
    expect(
      await works(null).repositoryForCheck(RunId.of('run_1'), 'api'),
    ).toBeNull();
  });
});
