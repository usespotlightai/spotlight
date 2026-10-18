import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { seenOf } from '@insights/domain/pull-requests.fake-spec';
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

const OWNER = { taskId: TaskId.of('task_1'), teamId: TeamId.of('team_1') };

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
    const reviewed = noted()
      .recordReview(TaskId.of('task_2'))
      .recordReview(TaskId.of('task_2'));

    expect(reviewed.reviewTasks).toEqual([TaskId.of('task_2')]);
  });

  it('outlives GitHub purging it only where a task owns or reviewed it', () => {
    const people = noted().seenAs(seenOf());

    expect(people.purgedByGitHub(SEEN_AT)).toBeNull();
    expect(people.assignOwner(OWNER).purgedByGitHub(SEEN_AT)).not.toBeNull();
    expect(
      people.recordReview(TaskId.of('task_2')).purgedByGitHub(SEEN_AT),
    ).not.toBeNull();
  });

  it('reads GitHub anew from its first version once GitHub purged it and recorded it again later', () => {
    const record = noted()
      .assignOwner(OWNER)
      .seenAs(seenOf({ version: 6 }))
      .purgedByGitHub(SEEN_AT);
    const back = record?.seenAs(
      seenOf({ title: 'Back', version: 1, updatedAt: LATER }),
    );

    expect(record?.githubPurgedAt).toEqual(SEEN_AT);
    expect(back?.seen?.title).toBe('Back');
    expect(back?.githubPurgedAt).toBeNull();
  });

  it('turns away what GitHub said no later than when it purged the pull request', () => {
    const record = noted()
      .assignOwner(OWNER)
      .seenAs(seenOf({ version: 6 }))
      .purgedByGitHub(SEEN_AT);

    expect(
      record?.seenAs(
        seenOf({ title: 'Stale', version: 7, updatedAt: SEEN_AT }),
      ),
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

    expect(record?.purgedByGitHub(SEEN_AT)).toBe(record);
    expect(record?.purgedByGitHub(LATER)).toBe(record);
  });

  it('lets go of a task, and of itself once nothing refers to it and GitHub purged it', () => {
    const owned = noted().assignOwner(OWNER).seenAs(seenOf());
    const purged = owned.purgedByGitHub(SEEN_AT);
    const unseen = noted().recordReview(TaskId.of('task_2'));

    expect(owned.withoutTask(OWNER.taskId)?.owner).toBeNull();
    expect(owned.withoutTask(OWNER.taskId)?.seen).not.toBeNull();
    expect(owned.withoutTask(TaskId.of('task_9'))).toBe(owned);
    expect(purged?.withoutTask(OWNER.taskId)).toBeNull();
    expect(unseen.withoutTask(TaskId.of('task_2'))).toBeNull();
    expect(
      purged?.recordReview(TaskId.of('task_2')).withoutTask(OWNER.taskId)
        ?.reviewTasks,
    ).toEqual([TaskId.of('task_2')]);
  });

  it('lets go of a deleted team, and of itself once GitHub purged it', () => {
    const owned = noted().assignOwner(OWNER).seenAs(seenOf());

    expect(owned.withoutTeam(OWNER.teamId)?.owner).toBeNull();
    expect(owned.withoutTeam(TeamId.of('team_2'))).toBe(owned);
    expect(owned.purgedByGitHub(SEEN_AT)?.withoutTeam(OWNER.teamId)).toBeNull();
  });
});
