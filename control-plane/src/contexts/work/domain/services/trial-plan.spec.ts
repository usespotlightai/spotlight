import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { UntrialableRunError } from '@work/domain/exceptions/untrialable-run.error';
import {
  type TrialOriginal,
  trialPlanFor,
} from '@work/domain/services/trial-plan';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { describe, expect, it } from 'vitest';

const BUILD = StationId.of('station_build');
const ACME_API = Repository.of('acme/api');
const FORK_API = Repository.of('fork/api');
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

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  repositories: [
    repositoryOf(ACME_API, { setup: 'npm ci' }),
    repositoryOf(FORK_API),
  ],
  stations: [
    station('station_backlog', 'backlog', 0, 'backlog'),
    station(BUILD.value, 'build', 1),
    station('station_completed', 'completed', 2, 'completed'),
  ],
});

const briefed = (reviewing: Repository | null) =>
  BriefedTask.of({
    stationId: BUILD,
    title: 'Drain the queue',
    description: 'It stalls on restart.',
    reviewing,
    attachments: [],
    notes: [],
    openReviewComments: [],
  });

const original = (repository: Repository | null): TrialOriginal => ({
  runId: RunId.of('run_1'),
  taskId: TaskId.of('task_1'),
  stationId: BUILD,
  archive: null,
  startedAt: new Date('2026-11-11T09:00:00.000Z'),
  checkouts: [{ checkedOutAt: 'api', repository, commit: COMMIT }],
});

const reasonOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof UntrialableRunError
      ? error.untrialableReason
      : 'other';
  }
};

describe('trialPlanFor', () => {
  it('starts each checkout of the repository the original started, at its commit, with that repository’s setup', () => {
    const plan = trialPlanFor({
      original: original(FORK_API),
      briefed: briefed(null),
      candidate: LINE,
    });

    expect(plan.checkouts).toEqual([{ repository: FORK_API, commit: COMMIT }]);
    expect(plan.at.checkouts).toEqual([
      {
        repository: FORK_API,
        branch: null,
        ref: COMMIT,
        diffOf: 'worktree',
        setup: null,
      },
    ]);
  });

  it('refuses a checkout of a repository the candidate no longer has, or does not review', () => {
    expect(
      reasonOf(() =>
        trialPlanFor({
          original: original(null),
          briefed: briefed(null),
          candidate: LINE,
        }),
      ),
    ).toBe('repository-gone');
    expect(
      reasonOf(() =>
        trialPlanFor({
          original: original(FORK_API),
          briefed: briefed(ACME_API),
          candidate: LINE,
        }),
      ),
    ).toBe('repository-gone');
  });
});
