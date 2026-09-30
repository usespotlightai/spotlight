import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const FIRST = PullRequestUrl.of('https://github.com/acme/api/pull/1');
const SECOND = PullRequestUrl.of('https://github.com/acme/api/pull/2');
const AT = new Date('2026-09-30T12:00:00.000Z');

const opened = () =>
  TaskDelivery.opened({
    taskId: TaskId.of('task_1'),
    workspaceId: WORKSPACE,
    pullRequest: FIRST,
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
      .reopenedAs(SECOND);

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

    expect(merged.reopenedAs(FIRST)).toBe(merged);
  });
});
