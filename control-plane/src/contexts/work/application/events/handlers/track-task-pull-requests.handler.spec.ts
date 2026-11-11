import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TrackTaskPullRequests } from '@work/application/events/handlers/track-task-pull-requests.handler';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const NOTHING_HELD = { line: null, ranksAtHeldMove: [] };

const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = new Date('2026-11-11T10:00:00.000Z');
const CLOSED_AT = new Date('2026-11-11T09:30:00.000Z');
const API = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const DOCS = PullRequestUrl.of('https://github.com/acme/docs/pull/3');

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

const owning = (...pullRequests: PullRequestUrl[]) =>
  Task.rehydrate({
    ...Task.add({
      line,
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has an entry
      at: line.entry!.id,
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: fresh,
    }),
    heldMarks: pullRequests.map((each) =>
      HeldMark.of(Mark.pullRequest(each), NOW),
    ),
    ownedPullRequests: pullRequests.map((each) =>
      OwnedPullRequest.of(each, NOW),
    ),
  });

const tracking = (stored: readonly Task[]) => {
  const saved: Task[] = [];
  const tasks = {
    owningPullRequest: async (_at: WorkspaceId, pullRequest: PullRequestUrl) =>
      stored.find((each) =>
        each.pullRequests.some((owned) => owned.equals(pullRequest)),
      ) ?? null,
    save: async (each: Task) => {
      saved.push(each);
    },
  } as unknown as TaskRepository;

  return {
    saved,
    handler: new TrackTaskPullRequests(
      tasks,
      { findByStation: async () => line },
      { placementsAt: async () => [] },
      { runIdFor: async () => RunId.of('run_9') },
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => undefined },
    ),
  };
};

const holding = (to: string, ...pullRequests: PullRequestUrl[]) =>
  Task.rehydrate({
    ...owning(...pullRequests),
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has the station
    moveHeldTo: line.stations.find((each) => each.key.value === to)!.id,
  });

describe('TrackTaskPullRequests', () => {
  it('makes the move a pull request close held once the last pull request of the task closes, and starts its run', async () => {
    const owner = holding('code-review', API, DOCS);
    const { handler, saved } = tracking([owner]);

    await handler.closed(WORKSPACE, API, CLOSED_AT);

    expect(saved[0]?.stationId.equals(owner.stationId)).toBe(true);
    expect(saved[0]?.moveHeldTo).toEqual(owner.moveHeldTo);

    const { handler: last, saved: moved } = tracking(saved);

    await last.closed(WORKSPACE, DOCS, CLOSED_AT);

    expect(moved[0]?.stationId).toEqual(owner.moveHeldTo);
    expect(moved[0]?.moveHeldTo).toBeNull();
    expect(moved[0]?.currentRunId?.value).toBe('run_9');
  });

  it('records the close on the task that owns the pull request, at the time GitHub closed it', async () => {
    const owner = owning(API, DOCS);
    const { handler, saved } = tracking([owner]);

    await handler.closed(WORKSPACE, API, CLOSED_AT);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.openPullRequests).toEqual([DOCS]);
    expect(
      saved[0]?.ownedPullRequests.find((each) => each.url.equals(API))
        ?.closedAt,
    ).toEqual(CLOSED_AT);
  });

  it('records the close on the owner after the mark of the pull request moved to another task', async () => {
    const owner = owning(API).releaseMark(Mark.pullRequest(API));
    const { handler, saved } = tracking([owner]);

    await handler.closed(WORKSPACE, API, null);

    expect(saved[0]?.id.equals(owner.id)).toBe(true);
    expect(saved[0]?.openPullRequests).toEqual([]);
  });

  it('records a reopen on the task that owns the pull request', async () => {
    const owner = owning(API).pullRequestClosed(API, NOW, NOTHING_HELD);
    const { handler, saved } = tracking([owner]);

    await handler.reopened(WORKSPACE, API);

    expect(saved[0]?.openPullRequests).toEqual([API]);
  });

  it('saves nothing for a pull request no task owns, or a close already recorded', async () => {
    const closed = owning(API).pullRequestClosed(API, NOW, NOTHING_HELD);
    const { handler, saved } = tracking([closed]);

    await handler.closed(WORKSPACE, API, NOW);
    await handler.closed(WORKSPACE, DOCS, NOW);

    expect(saved).toEqual([]);
  });
});
