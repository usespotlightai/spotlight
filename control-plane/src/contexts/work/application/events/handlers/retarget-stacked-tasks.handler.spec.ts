import type { PullRequestAt } from '@github/application/ports/pull-request.port';
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
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = new Date('2026-11-23T10:00:00.000Z');
const API = Repository.of('acme/api');
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
}) =>
  Task.rehydrate({
    ...Task.add({
      line,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has an entry
      at: line.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      branch: Branch.of(input.branch),
      base: input.base,
      now: NOW,
      newId: fresh,
    }),
    ownedPullRequests: input.pullRequests.map((each) =>
      OwnedPullRequest.of(each, NOW),
    ),
  });

const retargeting = (stored: readonly Task[]) => {
  const saved: Task[] = [];
  const moved: [number, string | null][] = [];
  const tasks = {
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
  } as unknown as TaskRepository;

  return {
    saved,
    moved,
    handler: new RetargetStackedTasks(
      tasks,
      {
        retarget: async (at: PullRequestAt, base: string | null) => {
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

    await handler.merged(WORKSPACE, PARENT_PR, API);

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

    await handler.merged(WORKSPACE, PARENT_PR, API);

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

    await handler.merged(WORKSPACE, PARENT_PR, API);

    expect(moved).toEqual([[8, null]]);
    expect(saved).toEqual([]);
  });

  it('does nothing for a pull request no task owns', async () => {
    const { handler, saved, moved } = retargeting([]);

    await handler.merged(WORKSPACE, PARENT_PR, API);

    expect(moved).toEqual([]);
    expect(saved).toEqual([]);
  });
});
