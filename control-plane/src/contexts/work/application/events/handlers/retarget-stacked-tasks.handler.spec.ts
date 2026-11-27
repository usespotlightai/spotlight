import type { PullRequestAt } from '@github/application/ports/pull-request.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RetargetStackedTasks } from '@work/application/events/handlers/retarget-stacked-tasks.handler';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { RequestedBase } from '@work/domain/value-objects/requested-base.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = new Date('2026-11-23T10:00:00.000Z');
const API = Repository.of('acme/api');
const DOCS = Repository.of('acme/docs');
const PARENT_PR = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const PARENT_DOCS_PR = PullRequestUrl.of('https://github.com/acme/docs/pull/2');
const CHILD_PR = PullRequestUrl.of('https://github.com/acme/api/pull/8');
const CHILD_DOCS_PR = PullRequestUrl.of('https://github.com/acme/docs/pull/3');
const RELEASE = Branch.of('release/1.x');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const line = deliveryLineOf({
  harness: HarnessId.of('dev'),
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  newId: fresh,
});

const taskOf = (input: {
  branch: string;
  base: Branch | null;
  pullRequests: readonly PullRequestUrl[];
  merged?: readonly PullRequestUrl[];
}) =>
  Task.rehydrate({
    ...Task.add({
      line,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has an entry
      at: line.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      branch: Branch.of(input.branch),
      base: input.base && RequestedBase.of(input.base, []),
      now: NOW,
      newId: fresh,
    }),
    ownedPullRequests: [
      ...input.pullRequests.map((each) => OwnedPullRequest.of(each, NOW)),
      ...(input.merged ?? []).map((each) =>
        OwnedPullRequest.of(each, NOW, NOW, false, true),
      ),
    ],
  });

const retargeting = (
  stored: readonly Task[],
  refused: readonly number[] = [],
) => {
  const saved: Task[] = [];
  const moved: [number, string | null][] = [];
  const tasks = partial<TaskRepository>({
    owningPullRequest: async (_at: WorkspaceId, pullRequest: PullRequestUrl) =>
      stored.find((each) =>
        each.ownedPullRequests.some((owned) => owned.url.equals(pullRequest)),
      ) ?? null,
    startingFrom: async (_at: WorkspaceId, base: Branch) =>
      stored.filter((each) => each.base?.equals(base) ?? false),
    find: async (id: Task['id']) =>
      stored.find((each) => each.id.equals(id)) ?? null,
    save: async (each: Task) => {
      saved.push(each);
    },
  });

  return {
    saved,
    moved,
    handler: new RetargetStackedTasks(
      tasks,
      {
        retarget: async (at: PullRequestAt, base: string | null) => {
          if (refused.includes(at.number)) {
            throw new Error(`GitHub refused pull request ${at.number}`);
          }

          moved.push([at.number, base]);
        },
      },
      { inTransaction: (work) => work() },
    ),
  };
};

describe('RetargetStackedTasks', () => {
  it('moves the pull requests of a task stacked on a merged one into the base the merged task had, and the task with them', async () => {
    const parent = taskOf({
      branch: 'feat/uploads',
      base: RELEASE,
      pullRequests: [PARENT_PR],
    });
    const child = taskOf({
      branch: 'feat/retries',
      base: Branch.of('feat/uploads'),
      pullRequests: [CHILD_PR, CHILD_DOCS_PR],
    });
    const { handler, saved, moved } = retargeting([parent, child]);

    await handler.closed(WORKSPACE, PARENT_PR, API, true);

    expect(moved).toEqual([[8, 'release/1.x']]);
    expect(saved.map((each) => each.base?.value)).toEqual(['release/1.x']);
  });

  it('moves them into the default branch when the merged task had no base', async () => {
    const parent = taskOf({
      branch: 'feat/uploads',
      base: null,
      pullRequests: [PARENT_PR],
    });
    const child = taskOf({
      branch: 'feat/retries',
      base: Branch.of('feat/uploads'),
      pullRequests: [CHILD_PR],
    });
    const { handler, saved, moved } = retargeting([parent, child]);

    await handler.closed(WORKSPACE, PARENT_PR, API, true);

    expect(moved).toEqual([[8, null]]);
    expect(saved.map((each) => each.base)).toEqual([null]);
  });

  it('keeps the base of the stacked task while the merged task still has an open pull request elsewhere', async () => {
    const parent = taskOf({
      branch: 'feat/uploads',
      base: null,
      pullRequests: [PARENT_PR, PARENT_DOCS_PR],
    });
    const child = taskOf({
      branch: 'feat/retries',
      base: Branch.of('feat/uploads'),
      pullRequests: [CHILD_PR],
    });
    const { handler, saved, moved } = retargeting([parent, child]);

    await handler.closed(WORKSPACE, PARENT_PR, API, true);

    expect(moved).toEqual([[8, null]]);
    expect(saved).toEqual([]);
  });

  it('moves the stacked task once the last open pull request of the merged task closes without a merge', async () => {
    const parent = taskOf({
      branch: 'feat/uploads',
      base: RELEASE,
      pullRequests: [PARENT_DOCS_PR],
      merged: [PARENT_PR],
    });
    const child = taskOf({
      branch: 'feat/retries',
      base: Branch.of('feat/uploads'),
      pullRequests: [CHILD_PR, CHILD_DOCS_PR],
    });
    const { handler, saved, moved } = retargeting([parent, child]);

    await handler.closed(WORKSPACE, PARENT_DOCS_PR, DOCS, false);

    expect(moved).toEqual([]);
    expect(saved.map((each) => each.base?.value)).toEqual(['release/1.x']);
  });

  it('leaves a task stacked on a task whose pull requests all closed without a merge', async () => {
    const parent = taskOf({
      branch: 'feat/uploads',
      base: RELEASE,
      pullRequests: [PARENT_PR],
    });
    const child = taskOf({
      branch: 'feat/retries',
      base: Branch.of('feat/uploads'),
      pullRequests: [CHILD_PR],
    });
    const { handler, saved, moved } = retargeting([parent, child]);

    await handler.closed(WORKSPACE, PARENT_PR, API, false);

    expect(moved).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('moves the other stacked tasks when GitHub refuses one retarget, keeps the refused task where it was, and fails so the close is taken again', async () => {
    const parent = taskOf({
      branch: 'feat/uploads',
      base: RELEASE,
      pullRequests: [PARENT_PR],
    });
    const refused = taskOf({
      branch: 'feat/retries',
      base: Branch.of('feat/uploads'),
      pullRequests: [CHILD_PR],
    });
    const other = taskOf({
      branch: 'feat/limits',
      base: Branch.of('feat/uploads'),
      pullRequests: [PullRequestUrl.of('https://github.com/acme/api/pull/9')],
    });
    const { handler, saved, moved } = retargeting(
      [parent, refused, other],
      [8],
    );

    await expect(
      handler.closed(WORKSPACE, PARENT_PR, API, true),
    ).rejects.toThrow(AggregateError);

    expect(moved).toEqual([[9, 'release/1.x']]);
    expect(saved.map((each) => each.id)).toEqual([other.id]);
  });

  it('does nothing for a pull request no task owns', async () => {
    const { handler, saved, moved } = retargeting([]);

    await handler.closed(WORKSPACE, PARENT_PR, API, true);

    expect(moved).toEqual([]);
    expect(saved).toEqual([]);
  });
});
