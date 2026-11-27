import { instanceOf } from '@shared-kernel/domain/instance-of.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskBaseMoved } from '@work/domain/events/task-base-moved.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { Branch } from '@work/domain/value-objects/branch.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { RefUpdate } from '@work/domain/value-objects/ref-update.vo';
import { RequestedBase } from '@work/domain/value-objects/requested-base.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-23T10:00:00Z');
const LATER = new Date('2026-11-23T11:00:00Z');
const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');
const MAIN = Branch.of('main');
const NONE = '0'.repeat(40);
const FIRST = '1'.repeat(40);
const SECOND = '2'.repeat(40);
const THEIRS = '3'.repeat(40);

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('station_1'),
      key: StationKey.of('build'),
      name: StationName.of('Build'),
      position: 1,
      harness: HarnessId.of('dev'),
    }),
    stationOf({
      id: StationId.of('completed_1'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      kind: 'completed',
    }),
  ],
});

const added = (base: Branch | null = null) =>
  Task.add({
    line: LINE,
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    base: base && RequestedBase.of(base, []),
    now: NOW,
    newId: () => 'task_1',
  });

const update = (
  ref: string,
  from: string,
  to: string,
  rewrites = false,
): RefUpdate => RefUpdate.of({ ref, from, to, rewrites });

describe('a task’s pushes', () => {
  const task = added();
  const own = `refs/heads/${task.branch.value}`;

  it('go only to the task’s own branch', () => {
    expect(task.pushRefusal(API, update(own, NONE, FIRST))).toBeNull();
    expect(
      task.pushRefusal(API, update('refs/heads/fix/other', NONE, FIRST)),
    ).toEqual({
      kind: 'push-to-another-branch',
      branch: Branch.of('fix/other'),
      taskBranch: task.branch,
    });
  });

  it('never go to the default branch, delete a branch or update a tag', () => {
    expect(
      task.pushRefusal(API, update('refs/heads/main', FIRST, SECOND)),
    ).toEqual({
      kind: 'push-to-another-branch',
      branch: MAIN,
      taskBranch: task.branch,
    });
    expect(task.pushRefusal(API, update(own, FIRST, NONE))).toEqual({
      kind: 'push-deletes-a-branch',
      branch: task.branch,
    });
    expect(task.pushRefusal(API, update('refs/tags/v1', NONE, FIRST))).toEqual({
      kind: 'push-not-to-a-branch',
      ref: 'refs/tags/v1',
    });
  });

  it('rewrite the branch only over a commit Spotlight pushed for the task in that repository', () => {
    const pushed = task.pushedTo(API, [update(own, NONE, FIRST)], NOW);

    expect(
      pushed.pushRefusal(API, update(own, FIRST, SECOND, true)),
    ).toBeNull();
    expect(pushed.pushRefusal(API, update(own, THEIRS, SECOND, true))).toEqual({
      kind: 'push-rewrites-commits-of-others',
      branch: task.branch,
    });
    expect(pushed.pushRefusal(WEB, update(own, FIRST, SECOND, true))).toEqual({
      kind: 'push-rewrites-commits-of-others',
      branch: task.branch,
    });
  });

  it('never rewrite a branch Spotlight has not pushed, but may build on it', () => {
    expect(task.pushRefusal(API, update(own, THEIRS, SECOND, true))).toEqual({
      kind: 'push-rewrites-commits-of-others',
      branch: task.branch,
    });
    expect(task.pushRefusal(API, update(own, THEIRS, SECOND))).toBeNull();
  });

  it('never rewrite a person’s commit that the branch took in an earlier push', () => {
    const mine = task.pushedTo(API, [update(own, NONE, FIRST)], NOW);
    const onTheirs = mine.pushedTo(API, [update(own, THEIRS, SECOND)], LATER);

    expect(onTheirs.pushRefusal(API, update(own, SECOND, FIRST, true))).toEqual(
      { kind: 'push-rewrites-commits-of-others', branch: task.branch },
    );
    expect(onTheirs.pushRefusal(API, update(own, SECOND, FIRST))).toBeNull();
    expect(
      onTheirs
        .pushedTo(API, [update(own, SECOND, FIRST)], LATER)
        .pushRefusal(API, update(own, FIRST, THEIRS, true)),
    ).toEqual({ kind: 'push-rewrites-commits-of-others', branch: task.branch });
  });

  it('rewrite again over a branch that holds only commits Spotlight pushed', () => {
    const mine = task
      .pushedTo(API, [update(own, NONE, FIRST)], NOW)
      .pushedTo(API, [update(own, FIRST, SECOND)], LATER)
      .pushedTo(API, [update(own, SECOND, THEIRS, true)], LATER);

    expect(mine.pushRefusal(API, update(own, THEIRS, FIRST, true))).toBeNull();
  });

  it('keep the last commit pushed per repository, and ignore other refs and deletes', () => {
    const pushed = task
      .pushedTo(API, [update(own, NONE, FIRST)], NOW)
      .pushedTo(WEB, [update(own, NONE, THEIRS)], NOW)
      .pushedTo(
        API,
        [
          update(own, FIRST, SECOND),
          update('refs/heads/fix/other', NONE, THEIRS),
        ],
        LATER,
      );

    expect(
      pushed.pushedHeads.map((each) => [
        each.repository.value,
        each.commit.value,
        each.pushedAt,
      ]),
    ).toEqual([
      ['acme/web', THEIRS, NOW],
      ['acme/api', SECOND, LATER],
    ]);
    expect(task.pushedTo(API, [update(own, FIRST, NONE)], NOW)).toBe(task);
  });
});

describe('a task’s base branch', () => {
  it('is the branch the task starts from, or none for the default branch', () => {
    expect(added(Branch.of('release/1.x')).base).toEqual(
      Branch.of('release/1.x'),
    );
    expect(added().base).toBeNull();
  });

  it('is never the task’s own branch', () => {
    const own = added().branch;

    expect(() => added(own)).toThrow(InvalidTaskTransitionError);
  });

  it('stays the same as the task changes', () => {
    const task = added(Branch.of('release/1.x'));

    expect(
      task.pushedTo(
        API,
        [update(`refs/heads/${task.branch.value}`, NONE, FIRST)],
        NOW,
      ).base,
    ).toEqual(Branch.of('release/1.x'));
  });
});

describe('a task stacked on another', () => {
  it('takes the base of the task it was stacked on once that one merges', () => {
    const stacked = added(Branch.of('feat/uploads'));

    expect(
      stacked.baseMerged(Branch.of('feat/uploads'), Branch.of('release/1.x'))
        .base?.value,
    ).toBe('release/1.x');
    expect(stacked.baseMerged(Branch.of('feat/uploads'), null).base).toBeNull();
    expect(stacked.baseMerged(Branch.of('feat/other'), null)).toBe(stacked);
  });

  it('records where its base moved from and to', () => {
    const moved = added(Branch.of('feat/uploads')).baseMerged(
      Branch.of('feat/uploads'),
      Branch.of('release/1.x'),
    );

    expect(
      moved
        .pullEvents()
        .filter((each) => each.kind === 'task.base-moved')
        .map((each) => [
          instanceOf(TaskBaseMoved, each).from.value,
          instanceOf(TaskBaseMoved, each).to?.value,
        ]),
    ).toEqual([['feat/uploads', 'release/1.x']]);
  });
});
