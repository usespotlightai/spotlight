import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { GitHubRepositoryEvents } from '@infrastructure/github/github-repository.events';
import { describe, expect, it } from 'vitest';

const reading = new GitHubRepositoryEvents();

const pull = (over: Record<string, unknown> = {}) => ({
  merged: true,
  html_url: 'https://github.com/acme/api/pull/7',
  head: { ref: 'spotlight/task_1' },
  ...over,
});

describe('GitHubRepositoryEvents', () => {
  it('reads a merged pull request', () => {
    expect(
      reading.read('pull_request', { action: 'closed', pull_request: pull() }),
    ).toMatchObject({
      happening: 'merged',
      concerns: {
        taskId: TaskId.of('task_1'),
        pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
      },
    });
  });

  it('tells a pull request closed without a merge from one merged', () => {
    expect(
      reading.read('pull_request', {
        action: 'closed',
        pull_request: pull({ merged: false }),
      }),
    ).toMatchObject({ happening: 'closed-unmerged' });
  });

  it('reads a comment, and carries what was said', () => {
    expect(
      reading.read('pull_request_review_comment', {
        action: 'created',
        pull_request: pull(),
        comment: { body: 'This retries forever.' },
      })?.said?.body,
    ).toBe('This retries forever.');
  });

  it('carries the file and line a review comment points at', () => {
    const read = reading.read('pull_request_review_comment', {
      action: 'created',
      pull_request: pull(),
      comment: {
        body: 'This retries forever.',
        path: 'runner/internal/session/session.go',
        line: 42,
      },
    });

    expect(read?.said?.place).toBe('runner/internal/session/session.go:42');
  });

  it('carries the whole span where a comment covers several lines', () => {
    const read = reading.read('pull_request_review_comment', {
      action: 'created',
      pull_request: pull(),
      comment: {
        body: 'Extract this.',
        path: 'compose.yml',
        start_line: 10,
        line: 14,
      },
    });

    expect(read?.said?.place).toBe('compose.yml:10-14');
  });

  it('falls back to the line a comment was first left on', () => {
    const read = reading.read('pull_request_review_comment', {
      action: 'created',
      pull_request: pull(),
      comment: { body: 'Still here?', path: 'compose.yml', original_line: 7 },
    });

    expect(read?.said?.place).toBe('compose.yml:7');
  });

  it('reads a comment left on the pull request itself', () => {
    expect(
      reading.read('issue_comment', {
        action: 'created',
        issue: {
          pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
        },
        comment: { body: 'Ship it once the tests pass.' },
      }),
    ).toMatchObject({
      happening: 'commented',
      concerns: {
        taskId: null,
        pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
      },
    });
  });

  it('tells a review asking for changes from one merely saying something', () => {
    const asked = reading.read('pull_request_review', {
      action: 'submitted',
      pull_request: pull(),
      review: { state: 'changes_requested', body: 'Handle the empty case.' },
    });
    const said = reading.read('pull_request_review', {
      action: 'submitted',
      pull_request: pull(),
      review: { state: 'commented', body: 'Reads well.' },
    });

    expect(asked).toMatchObject({ happening: 'changes-requested' });
    expect(said).toMatchObject({ happening: 'commented' });
  });

  it('reads a failing check suite by the branch it ran on', () => {
    expect(
      reading.read('check_suite', {
        action: 'completed',
        check_suite: { conclusion: 'failure', head_branch: 'spotlight/task_1' },
      }),
    ).toMatchObject({
      happening: 'checks-failed',
      concerns: { taskId: TaskId.of('task_1'), pullRequest: null },
    });
  });

  it('says nothing of a check suite that passed', () => {
    expect(
      reading.read('check_suite', {
        action: 'completed',
        check_suite: { conclusion: 'success', head_branch: 'spotlight/task_1' },
      }),
    ).toBeNull();
  });

  it('marks what Spotlight itself did, so it does not answer itself', () => {
    expect(
      reading.read('issue_comment', {
        action: 'created',
        issue: {
          pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
        },
        comment: { body: 'Opened by the agent.', user: { type: 'Bot' } },
      }),
    ).toMatchObject({ ourOwn: true });
  });

  it('says nothing of an event it was not asked to read', () => {
    expect(reading.read('push', { pull_request: pull() })).toBeNull();
    expect(reading.read(undefined, undefined)).toBeNull();
  });

  it('refuses a delivery it should have understood and could not', () => {
    expect(() =>
      reading.read('pull_request', {
        action: 'closed',
        pull_request: { merged: true },
      }),
    ).toThrow(UpstreamRefusedError);
  });
});
