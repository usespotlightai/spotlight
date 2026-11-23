import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { stackedTaskMoves } from '@work/domain/services/stacked-task-moves';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-23T10:00:00.000Z');
const API_PR = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const DOCS_PR = PullRequestUrl.of('https://github.com/acme/docs/pull/2');
const RELEASE = Branch.of('release/1.x');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const line = deliveryLineOf({
  harness: HarnessId.of('dev'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  newId: fresh,
});

const taskOf = (
  branch: string,
  base: Branch | null,
  owned: readonly OwnedPullRequest[],
) =>
  Task.rehydrate({
    ...Task.add({
      line,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has an entry
      at: line.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      branch: Branch.of(branch),
      base,
      now: NOW,
      newId: fresh,
    }),
    ownedPullRequests: owned,
  });

const open = (url: string) => OwnedPullRequest.of(PullRequestUrl.of(url), NOW);
const merged = (url: PullRequestUrl) =>
  OwnedPullRequest.of(url, NOW, NOW, false, true);

describe('stackedTaskMoves', () => {
  const stacked = taskOf('feat/retries', Branch.of('feat/uploads'), [
    open('https://github.com/acme/api/pull/8'),
    open('https://github.com/acme/docs/pull/3'),
  ]);
  const elsewhere = taskOf('feat/limits', RELEASE, [
    open('https://github.com/acme/api/pull/9'),
  ]);

  it('retargets, in the merged repository only, the open pull requests of tasks that start from the merged branch, into its base', () => {
    const parent = taskOf('feat/uploads', RELEASE, [
      OwnedPullRequest.of(API_PR, NOW),
      OwnedPullRequest.of(DOCS_PR, NOW),
    ]);

    const moves = stackedTaskMoves(parent, { url: API_PR, merged: true }, [
      stacked,
      elsewhere,
    ]);

    expect(moves.into).toEqual(RELEASE);
    expect(moves.retargets.map((each) => each.number)).toEqual([8]);
    expect(moves.moved).toEqual([]);
  });

  it('moves the stacked tasks once the parent has no open pull request and one of them merged', () => {
    const parent = taskOf('feat/uploads', null, [
      merged(API_PR),
      OwnedPullRequest.of(DOCS_PR, NOW),
    ]);

    const moves = stackedTaskMoves(parent, { url: DOCS_PR, merged: false }, [
      stacked,
      elsewhere,
    ]);

    expect(moves.retargets).toEqual([]);
    expect(moves.moved).toEqual([stacked]);
  });

  it('moves nothing when every pull request of the parent closed without a merge', () => {
    const parent = taskOf('feat/uploads', null, [
      OwnedPullRequest.of(API_PR, NOW),
    ]);

    const moves = stackedTaskMoves(parent, { url: API_PR, merged: false }, [
      stacked,
    ]);

    expect(moves.retargets).toEqual([]);
    expect(moves.moved).toEqual([]);
  });
});
