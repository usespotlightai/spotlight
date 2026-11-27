import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import { ReviewWorkAccess } from '@change-review/application/services/review-work-access.service';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { commitSha as sha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { RepositoryStack } from '@change-review/domain/value-objects/repository-stack.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const RUNNER = RunnerId.of('pooled_1');
const OTHER = RunnerId.of('pooled_2');
const SHARED = 'work_1';

const checking = () =>
  StackCheck.begin({
    stackId: ChangeStackId.of(SHARED),
    runId: RunId.of('run_1'),
    taskId: null,
    teamId: TeamId.of('team_1'),
    trial: false,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null),
    stack: RepositoryStack.of({ repository: null, startedAt: NOW }),
    entries: [],
    now: NOW,
  }).claimedFor(RUNNER, RunnerOffer.none(), NOW);

const diffing = () =>
  PushDiff.record({
    id: PushDiffId.of(SHARED),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
    push: {
      head: sha('b'),
      baseTip: sha('a'),
      pushedBy: null,
      pushedAt: NOW,
    },
    placement: RunnerPlacement.anywhere(),
    now: NOW,
  }).claimedFor(RUNNER, RunnerOffer.none(), NOW);

const access = (
  checks: readonly StackCheck[],
  diffs: readonly PushDiff[],
  stackRepository: string | null = null,
) => {
  const ofStack = vi.fn(() => Promise.resolve(checks));
  const find = vi.fn((id: PushDiffId) =>
    Promise.resolve(diffs.find((each) => each.id.equals(id)) ?? null),
  );
  const repositoryOf = vi.fn(() =>
    Promise.resolve({ repository: stackRepository }),
  );

  return {
    ofStack,
    find,
    service: new ReviewWorkAccess(
      partial<StackCheckRepository>({ ofStack }),
      partial<ChangeStackReaderPort>({ repositoryOf }),
      partial<PushDiffRepository>({ find }),
    ),
  };
};

describe('ReviewWorkAccess', () => {
  it('answers a check its runner leases from the checks alone, with its run', async () => {
    const { service, find } = access([checking()], [diffing()]);

    await expect(
      service.leasedWork({ kind: 'check', id: SHARED }, RUNNER, NOW),
    ).resolves.toEqual({
      runId: RunId.of('run_1'),
      taskId: null,
      repository: null,
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('answers a check with the repository of its stack, so it reads no other', async () => {
    const { service } = access([checking()], [], 'Widgets');

    await expect(
      service.leasedWork({ kind: 'check', id: SHARED }, RUNNER, NOW),
    ).resolves.toEqual({
      runId: RunId.of('run_1'),
      taskId: null,
      repository: 'Widgets',
    });
  });

  it('answers a push diff its runner leases from the diffs alone, with its task and repository', async () => {
    const { service, ofStack } = access([checking()], [diffing()]);

    await expect(
      service.leasedWork({ kind: 'diff', id: SHARED }, RUNNER, NOW),
    ).resolves.toEqual({
      runId: null,
      taskId: TaskId.of('task_1'),
      repository: 'widgets',
    });
    expect(ofStack).not.toHaveBeenCalled();
  });

  it('answers nothing for work another runner leases, or work of the other kind', async () => {
    const onlyChecks = access([checking()], []);
    const onlyDiffs = access([], [diffing()]);

    await expect(
      onlyChecks.service.leasedWork({ kind: 'check', id: SHARED }, OTHER, NOW),
    ).resolves.toBeNull();
    await expect(
      onlyDiffs.service.leasedWork({ kind: 'diff', id: SHARED }, OTHER, NOW),
    ).resolves.toBeNull();
    await expect(
      onlyChecks.service.leasedWork({ kind: 'diff', id: SHARED }, RUNNER, NOW),
    ).resolves.toBeNull();
    await expect(
      onlyDiffs.service.leasedWork({ kind: 'check', id: SHARED }, RUNNER, NOW),
    ).resolves.toBeNull();
  });
});
