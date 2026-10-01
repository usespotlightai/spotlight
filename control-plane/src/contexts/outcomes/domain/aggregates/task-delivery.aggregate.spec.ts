import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { TEAM, WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const FIRST = PullRequestUrl.of('https://github.com/acme/api/pull/1');
const SECOND = PullRequestUrl.of('https://github.com/acme/api/pull/2');
const AT = new Date('2026-09-30T12:00:00.000Z');
const OPENED = new Date('2026-09-30T10:00:00.000Z');

const opened = () =>
  TaskDelivery.opened({
    taskId: TaskId.of('task_1'),
    workspaceId: WORKSPACE,
    teamId: TEAM,
    pullRequest: FIRST,
    at: OPENED,
  });

describe('TaskDelivery', () => {
  it('opens with the task’s pull request', () => {
    expect(opened().state).toBe('open');
    expect(opened().pullRequest.equals(FIRST)).toBe(true);
  });

  it('merges when its pull request merges', () => {
    const merged = opened().closed({
      pullRequest: FIRST,
      merged: true,
      at: AT,
    });

    expect(merged.state).toBe('merged');
    expect(merged.closedAt).toEqual(AT);
  });

  it('closes when its pull request closes unmerged', () => {
    expect(
      opened().closed({ pullRequest: FIRST, merged: false, at: AT }).state,
    ).toBe('closed');
  });

  it('stays merged once merged', () => {
    const merged = opened().closed({
      pullRequest: FIRST,
      merged: true,
      at: AT,
    });

    expect(merged.closed({ pullRequest: FIRST, merged: false, at: AT })).toBe(
      merged,
    );
  });

  it('merges after it was closed, as a reopened pull request can', () => {
    const merged = opened()
      .closed({ pullRequest: FIRST, merged: false, at: AT })
      .closed({ pullRequest: FIRST, merged: true, at: AT });

    expect(merged.state).toBe('merged');
  });

  it('ignores another pull request closing', () => {
    const delivery = opened();

    expect(delivery.closed({ pullRequest: SECOND, merged: true, at: AT })).toBe(
      delivery,
    );
  });

  it('follows a new pull request the task opens, open again', () => {
    const reopened = opened()
      .closed({ pullRequest: FIRST, merged: false, at: AT })
      .reopenedAs(SECOND, AT);

    expect(reopened.pullRequest.equals(SECOND)).toBe(true);
    expect(reopened.state).toBe('open');
    expect(reopened.closedAt).toBeNull();
  });

  it('is left as it is when the same pull request is opened again', () => {
    const merged = opened().closed({
      pullRequest: FIRST,
      merged: true,
      at: AT,
    });

    expect(merged.reopenedAs(FIRST, AT)).toBe(merged);
  });

  it('dates its first review by a person, keeping the earliest', () => {
    const reviewed = opened()
      .reviewed({ pullRequest: FIRST, at: AT, byBot: false })
      .reviewed({ pullRequest: FIRST, at: OPENED, byBot: false });

    expect(reviewed.firstReviewAt).toEqual(OPENED);
    expect(
      reviewed.reviewed({
        pullRequest: FIRST,
        at: new Date('2026-09-30T13:00:00.000Z'),
        byBot: false,
      }),
    ).toBe(reviewed);
  });

  it('counts no bot’s review, nor one of another pull request', () => {
    const delivery = opened();

    expect(delivery.reviewed({ pullRequest: FIRST, at: AT, byBot: true })).toBe(
      delivery,
    );
    expect(
      delivery.reviewed({ pullRequest: SECOND, at: AT, byBot: false }),
    ).toBe(delivery);
    expect(
      delivery.reviewed({ pullRequest: FIRST, at: null, byBot: false }),
    ).toBe(delivery);
  });

  it('starts over when the task opens a new pull request', () => {
    const reopened = opened()
      .reviewed({ pullRequest: FIRST, at: AT, byBot: false })
      .reopenedAs(SECOND, AT);

    expect(reopened.openedAt).toEqual(AT);
    expect(reopened.firstReviewAt).toBeNull();
  });
});
