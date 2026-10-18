import { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import type { TaskPullRequestClosed } from '@insights/domain/events/task-pull-request-closed.event';
import { TEAM, WORKSPACE } from '@insights/domain/runs.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const FIRST = PullRequestUrl.of('https://github.com/acme/api/pull/1');
const SECOND = PullRequestUrl.of('https://github.com/acme/api/pull/2');
const AT = new Date('2026-09-30T12:00:00.000Z');
const OPENED = new Date('2026-09-30T10:00:00.000Z');

const opened = () =>
  TaskPullRequest.open({
    taskId: TaskId.of('task_1'),
    workspaceId: WORKSPACE,
    teamId: TEAM,
    pullRequest: FIRST,
    at: OPENED,
  });

describe('TaskPullRequest', () => {
  it('opens with the task’s pull request', () => {
    expect(opened().state).toBe('open');
    expect(opened().pullRequest.equals(FIRST)).toBe(true);
  });

  it('merges when its pull request merges', () => {
    const merged = opened().close({
      pullRequest: FIRST,
      merged: true,
      at: AT,
    });

    expect(merged.state).toBe('merged');
    expect(merged.closedAt).toEqual(AT);
  });

  it('closes when its pull request closes unmerged', () => {
    expect(
      opened().close({ pullRequest: FIRST, merged: false, at: AT }).state,
    ).toBe('closed');
  });

  it('stays merged once merged', () => {
    const merged = opened().close({
      pullRequest: FIRST,
      merged: true,
      at: AT,
    });

    expect(merged.close({ pullRequest: FIRST, merged: false, at: AT })).toBe(
      merged,
    );
  });

  it('merges after it was closed, as a reopened pull request can', () => {
    const merged = opened()
      .close({ pullRequest: FIRST, merged: false, at: AT })
      .close({ pullRequest: FIRST, merged: true, at: AT });

    expect(merged.state).toBe('merged');
  });

  it('ignores another pull request closing', () => {
    const taskPullRequest = opened();

    expect(
      taskPullRequest.close({ pullRequest: SECOND, merged: true, at: AT }),
    ).toBe(taskPullRequest);
  });

  it('follows a new pull request the task opens, open again', () => {
    const reopened = opened()
      .close({ pullRequest: FIRST, merged: false, at: AT })
      .reopen(SECOND, AT);

    expect(reopened.pullRequest.equals(SECOND)).toBe(true);
    expect(reopened.state).toBe('open');
    expect(reopened.closedAt).toBeNull();
  });

  it('is left as it is when the same pull request is opened again', () => {
    const merged = opened().close({
      pullRequest: FIRST,
      merged: true,
      at: AT,
    });

    expect(merged.reopen(FIRST, AT)).toBe(merged);
  });

  it('dates its first review by a person, keeping the earliest', () => {
    const reviewed = opened()
      .recordReview({ pullRequest: FIRST, at: AT, byBot: false })
      .recordReview({ pullRequest: FIRST, at: OPENED, byBot: false });

    expect(reviewed.firstReviewAt).toEqual(OPENED);
    expect(
      reviewed.recordReview({
        pullRequest: FIRST,
        at: new Date('2026-09-30T13:00:00.000Z'),
        byBot: false,
      }),
    ).toBe(reviewed);
  });

  it('counts no bot’s review, nor one of another pull request', () => {
    const taskPullRequest = opened();

    expect(
      taskPullRequest.recordReview({ pullRequest: FIRST, at: AT, byBot: true }),
    ).toBe(taskPullRequest);
    expect(
      taskPullRequest.recordReview({
        pullRequest: SECOND,
        at: AT,
        byBot: false,
      }),
    ).toBe(taskPullRequest);
    expect(
      taskPullRequest.recordReview({
        pullRequest: FIRST,
        at: null,
        byBot: false,
      }),
    ).toBe(taskPullRequest);
  });

  it('starts over when the task opens a new pull request', () => {
    const reopened = opened()
      .recordReview({ pullRequest: FIRST, at: AT, byBot: false })
      .reopen(SECOND, AT);

    expect(reopened.openedAt).toEqual(AT);
    expect(reopened.firstReviewAt).toBeNull();
  });

  it('tells it closed each time its pull request closes or merges, carrying whether it merged', () => {
    const closed = opened()
      .recordReview({ pullRequest: FIRST, at: AT, byBot: false })
      .close({ pullRequest: FIRST, merged: false, at: AT })
      .close({ pullRequest: FIRST, merged: false, at: AT })
      .close({ pullRequest: FIRST, merged: true, at: AT });

    const events = closed.pullEvents();

    expect(events.map((each) => each.kind)).toEqual([
      'task-pull-request.closed',
      'task-pull-request.closed',
    ]);
    expect(
      events.map((each) => (each as TaskPullRequestClosed).merged),
    ).toEqual([false, true]);
    expect(closed.finished).toBe(true);
    expect(opened().finished).toBe(false);
  });
});
