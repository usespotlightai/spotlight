import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import {
  type ClosedPullRequest,
  SettleDecisions,
} from '@change-review/application/services/settle-decisions.service';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionGrounds } from '@change-review/domain/value-objects/decision-grounds.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-21T10:00:00Z');
const CLOSED_AT = new Date('2026-09-21T09:30:00Z');
const TASK = TaskId.of('task_1');
const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');

const MERGED: ClosedPullRequest = {
  workspaceId: WORKSPACE,
  pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
  repository: Repository.of('acme/api'),
  merge: { commit: 'c'.repeat(40) },
  closedAt: CLOSED_AT,
};

const decided = () =>
  DecisionSet.open({
    id: DecisionSetId.of('set_1'),
    taskId: TASK,
    workspaceId: WORKSPACE,
  })
    .asked(RUN, NOW)
    .recordDraft({
      runId: RUN,
      newId: () => 'decision_1',
      proposed: [
        {
          kind: 'limitation',
          title: 'Retries only once',
          why: 'Backoff is not in the client yet.',
          alternatives: [],
          paths: ['api/src/uploads.ts'],
          steps: [3],
        },
      ],
      grounds: DecisionGrounds.of({
        steps: [3],
        changed: ['api/src/uploads.ts'],
      }),
    });

const settling = (
  over: {
    task?: Partial<ReviewedTask> | null;
    stored?: DecisionSet | null;
  } = {},
) => {
  let stored: DecisionSet | null =
    over.stored === undefined ? decided() : over.stored;

  const work = {
    taskWithPullRequest: async (): Promise<ReviewedTask | null> =>
      over.task === null
        ? null
        : {
            id: TASK,
            workspaceId: WORKSPACE,
            teamId: null,
            pullRequest: null,
            reviewing: false,
            currentRunId: null,
            ...over.task,
          },
  } as unknown as WorkPort;

  const sets = {
    forTask: async () => stored,
    save: async (set: DecisionSet) => {
      stored = set.discarded ? null : set;
    },
  } as unknown as DecisionSetRepository;

  const service = new SettleDecisions(
    work,
    sets,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { now: () => NOW, sleep: async () => undefined },
  );

  return { service, stored: () => stored };
};

describe('settling a task’s decisions when its pull request closes', () => {
  it('merges them with the pull request', async () => {
    const { service, stored } = settling();

    await service.closed(MERGED);

    expect(stored()?.status.isMerged).toBe(true);
    expect(stored()?.status.merge).toMatchObject({
      commit: 'c'.repeat(40),
      at: CLOSED_AT,
    });
    expect(stored()?.status.merge?.repository.value).toBe('acme/api');
    expect(stored()?.decisions).toHaveLength(1);
  });

  it('forgets them when it closes unmerged', async () => {
    const { service, stored } = settling();

    await service.closed({ ...MERGED, merge: null });

    expect(stored()).toBeNull();
  });

  it('keeps them after they merge, whatever closes later', async () => {
    const { service, stored } = settling();

    await service.closed(MERGED);
    await service.closed({ ...MERGED, merge: null });

    expect(stored()?.status.isMerged).toBe(true);
  });

  it('leaves decisions alone for a pull request Spotlight only reviews', async () => {
    const { service, stored } = settling({ task: { reviewing: true } });

    await service.closed({ ...MERGED, merge: null });

    expect(stored()?.status.isMerged).toBe(false);
    expect(stored()?.decisions).toHaveLength(1);
  });

  it('does nothing for a pull request that no task has', async () => {
    const { service, stored } = settling({ task: null });

    await service.closed(MERGED);

    expect(stored()?.status.isMerged).toBe(false);
  });
});
