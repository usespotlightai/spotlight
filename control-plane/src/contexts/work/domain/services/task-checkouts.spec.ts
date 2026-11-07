import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import {
  checkoutsOf,
  repositoriesForTask,
  repositoryForTaskNamed,
} from '@work/domain/services/task-checkouts';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('default'),
  name: LineName.of('Default'),
  repositories: [repositoryOf(API, { setup: 'npm ci' }), repositoryOf(WEB)],
  stations: [
    stationOf({
      id: StationId.of('station_1'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 1,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const added = () =>
  Task.add({
    line: LINE,
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: new Date('2026-09-27T09:00:00.000Z'),
    newId: () => 'task_1',
  });

const reviewing = (url: string) =>
  added().reviews(
    PullRequestUrl.of(url),
    { outside: false },
    LINE,
    new Date(0),
  );

const names = (repositories: readonly Repository[]) =>
  repositories.map((each) => each.value);

describe('the repositories a task works on', () => {
  it('are every repository of its line, each checked out on the task’s branch', () => {
    const task = added();

    expect(names(repositoriesForTask(task, LINE))).toEqual([
      'acme/api',
      'acme/web',
    ]);
    expect(checkoutsOf(task, LINE)).toEqual([
      {
        repository: API,
        branch: task.branch,
        ref: null,
        diffOf: 'worktree',
        setup: 'npm ci',
      },
      {
        repository: WEB,
        branch: task.branch,
        ref: null,
        diffOf: 'worktree',
        setup: null,
      },
    ]);
  });

  it('are only the reviewed repository, checked out at the pull request’s head', () => {
    const task = reviewing('https://github.com/acme/api/pull/42');

    expect(names(repositoriesForTask(task, LINE))).toEqual(['acme/api']);
    expect(checkoutsOf(task, LINE)).toEqual([
      {
        repository: API,
        branch: null,
        ref: 'refs/pull/42/head',
        diffOf: 'commits',
        setup: 'npm ci',
      },
    ]);
    expect(
      repositoryForTaskNamed(RepositoryName.of('api'), task, LINE),
    ).toEqual(API);
    expect(
      repositoryForTaskNamed(RepositoryName.of('web'), task, LINE),
    ).toBeNull();
  });

  it('check out the task branch, or the reviewed head with its commits to diff', () => {
    const task = added();
    const review = reviewing('https://github.com/acme/api/pull/42');

    expect(checkoutsOf(task, LINE)).toEqual([
      {
        repository: API,
        branch: task.branch,
        ref: null,
        diffOf: 'worktree',
        setup: 'npm ci',
      },
      {
        repository: WEB,
        branch: task.branch,
        ref: null,
        diffOf: 'worktree',
        setup: null,
      },
    ]);
    expect(checkoutsOf(review, LINE)).toEqual([
      {
        repository: API,
        branch: null,
        ref: 'refs/pull/42/head',
        diffOf: 'commits',
        setup: 'npm ci',
      },
    ]);
  });

  it('are exactly the repositories checked out, whatever the task', () => {
    for (const task of [
      added(),
      reviewing('https://github.com/acme/api/pull/42'),
    ]) {
      expect(checkoutsOf(task, LINE).map((each) => each.repository)).toEqual(
        repositoriesForTask(task, LINE),
      );
    }
  });

  it('are every repository of the line when there is no task', () => {
    expect(names(repositoriesForTask(null, LINE))).toEqual([
      'acme/api',
      'acme/web',
    ]);
    expect(
      repositoryForTaskNamed(RepositoryName.of('web'), null, LINE),
    ).toEqual(WEB);
  });
});
