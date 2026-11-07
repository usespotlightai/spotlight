import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { InvalidPullRequestRecordError } from '@insights/domain/exceptions/invalid-pull-request-record.error';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { seenOf } from '@insights/pull-requests.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const noted = () =>
  PullRequestRecord.noted(
    WorkspaceId.of('ws_1'),
    PullRequestUrl.of('https://github.com/acme/api/pull/7'),
  );

const SEEN_AT = new Date('2026-09-28T09:00:00.000Z');
const LATER = new Date('2026-09-28T10:00:00.000Z');

const OPENED_AT = new Date('2026-09-28T08:00:00.000Z');

const REVIEW = { taskId: TaskId.of('task_2'), teamId: TeamId.of('team_7') };

const OWNER = {
  taskId: TaskId.of('task_1'),
  teamId: TeamId.of('team_1'),
  openedAt: OPENED_AT,
};

const kinds = (record: PullRequestRecord | null): readonly string[] =>
  record?.pullEvents().map((each) => each.kind) ?? [];

describe('PullRequestRecord', () => {
  it('keeps the newest of what GitHub said, however late an older word arrives', () => {
    const newer = noted().seenAs(seenOf({ title: 'Newer', version: 3 }));

    expect(newer.seenAs(seenOf({ title: 'Older', version: 2 }))).toBe(newer);
    expect(newer.seenAs(seenOf({ title: 'Same', version: 3 }))).toBe(newer);
    expect(
      newer.seenAs(seenOf({ title: 'Newest', version: 4 })).seen?.title,
    ).toBe('Newest');
  });

  it('is Spotlight’s once a task owns it, whenever that is received', () => {
    const owned = noted().assignOwner(OWNER).seenAs(seenOf());

    expect(owned.owner).toEqual(OWNER);
    expect(owned.assignOwner(OWNER)).toBe(owned);
  });

  it('remembers each review task that ran on it once', () => {
    const reviewed = noted().recordReview(REVIEW).recordReview(REVIEW);

    expect(reviewed.reviewTasks).toEqual([REVIEW]);
  });

  it('keeps only a tombstone once GitHub purges it, unless a task owns or reviewed it', () => {
    const people = noted().seenAs(seenOf());
    const owned = people.assignOwner(OWNER).purgedByGitHub(SEEN_AT);

    expect(people.purgedByGitHub(SEEN_AT).isTombstone).toBe(true);
    expect(people.purgedByGitHub(SEEN_AT).seen).toBeNull();
    expect(owned.isTombstone).toBe(false);
    expect(owned.seen).not.toBeNull();
    expect(
      people.recordReview(REVIEW).purgedByGitHub(SEEN_AT).isTombstone,
    ).toBe(false);
  });

  it('keeps a tombstone of a pull request GitHub purged before Spotlight saw it', () => {
    const tombstone = noted().purgedByGitHub(SEEN_AT);

    expect(tombstone.isTombstone).toBe(true);
    expect(tombstone.seenAs(seenOf({ updatedAt: SEEN_AT }))).toBe(tombstone);
    expect(tombstone.tombstoneExpiredBefore(LATER)).toBe(true);
    expect(tombstone.tombstoneExpiredBefore(SEEN_AT)).toBe(false);
  });

  it('refuses a stored record that holds nothing', () => {
    expect(() =>
      PullRequestRecord.rehydrate({
        workspaceId: WorkspaceId.of('ws_1'),
        pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
        seen: null,
        owner: null,
        reviewTasks: [],
        githubPurgedAt: null,
        version: 1,
      }),
    ).toThrow(InvalidPullRequestRecordError);
  });

  it('reads GitHub anew from its first version once GitHub purged it and recorded it again later', () => {
    const record = noted()
      .assignOwner(OWNER)
      .seenAs(seenOf({ version: 6 }))
      .purgedByGitHub(SEEN_AT);
    const back = record.seenAs(
      seenOf({ title: 'Back', version: 1, updatedAt: LATER }),
    );

    expect(record.githubPurgedAt).toEqual(SEEN_AT);
    expect(back?.seen?.title).toBe('Back');
    expect(back?.githubPurgedAt).toBeNull();
  });

  it('turns away what GitHub said no later than when it purged the pull request', () => {
    const record = noted()
      .assignOwner(OWNER)
      .seenAs(seenOf({ version: 6 }))
      .purgedByGitHub(SEEN_AT);

    expect(
      record.seenAs(seenOf({ title: 'Stale', version: 7, updatedAt: SEEN_AT })),
    ).toBe(record);
  });

  it('ignores GitHub purging an older record of a pull request it has received since', () => {
    const owned = noted()
      .assignOwner(OWNER)
      .seenAs(seenOf({ updatedAt: LATER }));
    const people = noted().seenAs(seenOf({ updatedAt: LATER }));

    expect(owned.purgedByGitHub(SEEN_AT)).toBe(owned);
    expect(people.purgedByGitHub(SEEN_AT)).toBe(people);
  });

  it('keeps the latest time GitHub purged it', () => {
    const record = noted().assignOwner(OWNER).purgedByGitHub(LATER);

    expect(record.purgedByGitHub(SEEN_AT)).toBe(record);
    expect(record.purgedByGitHub(LATER)).toBe(record);
  });

  it('lets go of a task, and keeps a tombstone once nothing refers to it and GitHub purged it', () => {
    const owned = noted().assignOwner(OWNER).seenAs(seenOf());
    const purged = owned.purgedByGitHub(SEEN_AT);
    const unseen = noted().recordReview(REVIEW);

    expect(
      owned.erasing(DeletionScope.ofTask(WorkspaceId.of('ws_1'), OWNER.taskId))
        ?.owner,
    ).toBeNull();
    expect(
      owned.erasing(DeletionScope.ofTask(WorkspaceId.of('ws_1'), OWNER.taskId))
        ?.seen,
    ).not.toBeNull();
    expect(
      owned.erasing(
        DeletionScope.ofTask(WorkspaceId.of('ws_1'), TaskId.of('task_9')),
      ),
    ).toBe(owned);
    expect(
      purged.erasing(DeletionScope.ofTask(WorkspaceId.of('ws_1'), OWNER.taskId))
        ?.isTombstone,
    ).toBe(true);
    expect(
      purged.erasing(DeletionScope.ofTask(WorkspaceId.of('ws_1'), OWNER.taskId))
        ?.seen,
    ).toBeNull();
    expect(
      unseen.erasing(
        DeletionScope.ofTask(WorkspaceId.of('ws_1'), TaskId.of('task_2')),
      ),
    ).toBeNull();
    expect(
      purged
        .recordReview(REVIEW)
        .erasing(DeletionScope.ofTask(WorkspaceId.of('ws_1'), OWNER.taskId))
        ?.reviewTasks,
    ).toEqual([REVIEW]);
  });

  it('lets go of a deleted team, and keeps a tombstone once GitHub purged it', () => {
    const owned = noted().assignOwner(OWNER).seenAs(seenOf());

    expect(
      owned.erasing(DeletionScope.ofTeam(WorkspaceId.of('ws_1'), OWNER.teamId))
        ?.owner,
    ).toBeNull();
    expect(
      owned.erasing(
        DeletionScope.ofTeam(WorkspaceId.of('ws_1'), TeamId.of('team_2')),
      ),
    ).toBe(owned);
    expect(
      owned
        .purgedByGitHub(SEEN_AT)
        .erasing(DeletionScope.ofTeam(WorkspaceId.of('ws_1'), OWNER.teamId))
        ?.isTombstone,
    ).toBe(true);
  });

  it('lets go of the review tasks of a deleted team', () => {
    const reviewed = noted()
      .seenAs(seenOf())
      .recordReview(REVIEW)
      .recordReview({ taskId: TaskId.of('task_3'), teamId: OWNER.teamId });

    expect(
      reviewed.erasing(
        DeletionScope.ofTeam(WorkspaceId.of('ws_1'), REVIEW.teamId),
      )?.reviewTasks,
    ).toEqual([{ taskId: TaskId.of('task_3'), teamId: OWNER.teamId }]);
    expect(
      noted()
        .recordReview(REVIEW)
        .erasing(DeletionScope.ofTeam(WorkspaceId.of('ws_1'), REVIEW.teamId)),
    ).toBeNull();
  });

  it('is the pull request of the task that owns it, open until GitHub says otherwise, with GitHub’s close and first review', () => {
    const owned = noted().assignOwner(OWNER);

    expect(owned.forTask).toMatchObject({
      taskId: OWNER.taskId,
      teamId: OWNER.teamId,
      state: 'open',
      openedAt: OPENED_AT,
      firstReviewAt: null,
      closedAt: null,
    });
    expect(
      owned.seenAs(
        seenOf({
          state: 'merged',
          closedAt: LATER,
          firstReviewAt: SEEN_AT,
        }),
      ).forTask,
    ).toMatchObject({
      state: 'merged',
      closedAt: LATER,
      firstReviewAt: SEEN_AT,
    });
    expect(noted().seenAs(seenOf()).forTask).toBeNull();
  });

  it('takes the latest pull request a task opened as the task’s own', () => {
    const first = noted().assignOwner(OWNER);
    const second = PullRequestRecord.noted(
      WorkspaceId.of('ws_1'),
      PullRequestUrl.of('https://github.com/acme/api/pull/8'),
    ).assignOwner({ ...OWNER, openedAt: LATER });

    expect(
      PullRequestRecord.latestOwnedOf([first, second])?.pullRequest.value,
    ).toBe('https://github.com/acme/api/pull/8');
    expect(PullRequestRecord.latestOwnedOf([])).toBeNull();
  });

  it('says when a task takes it, when GitHub’s view changes and when it closes for its task', () => {
    const owned = noted().assignOwner(OWNER);

    expect(kinds(owned)).toEqual(['pull-request-record.owned']);
    expect(owned.assignOwner(OWNER)).toBe(owned);
    expect(kinds(owned.seenAs(seenOf({ state: 'open' })))).toEqual([
      'pull-request-record.seen',
    ]);
    expect(
      kinds(owned.seenAs(seenOf({ state: 'merged', closedAt: LATER }))),
    ).toEqual(['pull-request-record.seen', 'pull-request-record.closed']);
    expect(
      kinds(
        noted()
          .seenAs(seenOf({ state: 'closed', closedAt: LATER }))
          .assignOwner(OWNER),
      ),
    ).toEqual([
      'pull-request-record.seen',
      'pull-request-record.owned',
      'pull-request-record.closed',
    ]);
  });

  it('says which tasks it let go of, and that it was erased', () => {
    const owned = noted().assignOwner(OWNER).seenAs(seenOf());
    owned.pullEvents();

    expect(
      kinds(
        owned.erasing(
          DeletionScope.ofTask(WorkspaceId.of('ws_1'), OWNER.taskId),
        ),
      ),
    ).toEqual(['pull-request-record.released']);
    expect(kinds(owned.erased())).toEqual(['pull-request-record.erased']);
  });
});
