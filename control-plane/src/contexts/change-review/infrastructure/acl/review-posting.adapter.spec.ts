import { ReviewPostingFailedError } from '@change-review/application/errors/review-posting-failed.error';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { GitHubReviewPosting } from '@change-review/infrastructure/acl/review-posting.adapter';
import { GitHubUnansweredError } from '@github/application/errors/github-unanswered.error';
import type { PullRequestReviewsPort } from '@github/application/ports/pull-request-reviews.port';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const removing = (error: Error) =>
  new GitHubReviewPosting(
    partial<PullRequestReviewsPort>({
      remove: () => Promise.reject(error),
    }),
  ).remove({
    workspaceId: WorkspaceId.of('workspace_1'),
    pullRequest: PullRequestUrl.of('https://github.com/acme/web/pull/7'),
    by: { kind: 'spotlight' },
    commentId: 1,
  });

const caughtOf = async (error: Error): Promise<ReviewPostingFailedError> => {
  const caught = await removing(error).catch((thrown: unknown) => thrown);

  if (!(caught instanceof ReviewPostingFailedError)) {
    throw new Error('expected a review posting failure');
  }

  return caught;
};

const failureOf = async (error: Error): Promise<DeliveryFailure> => {
  return (await caughtOf(error)).failure;
};

describe('GitHubReviewPosting', () => {
  it('counts a server error, a rate limit and a lost connection as GitHub being unreachable', async () => {
    expect(
      await failureOf(new UpstreamError('remove', 'Server Error', 502, true)),
    ).toEqual(DeliveryFailure.of('github-unreachable'));
    expect(
      await failureOf(
        new GitHubUnansweredError(
          'DELETE /repos/acme/web/pulls/comments/1',
          new TypeError('fetch failed'),
        ),
      ),
    ).toEqual(DeliveryFailure.of('github-unreachable'));
  });

  it('marks the outcome unknown only where GitHub sent no answer', async () => {
    const outcomeUnknown = async (error: Error) =>
      (await caughtOf(error)).outcomeUnknown;

    expect(
      await outcomeUnknown(
        new GitHubUnansweredError(
          'DELETE /repos/acme/web/pulls/comments/1',
          new DOMException('timed out', 'TimeoutError'),
        ),
      ),
    ).toBe(true);
    expect(
      await outcomeUnknown(
        new UpstreamError('remove', 'Server Error', 502, true),
      ),
    ).toBe(false);
  });

  it('keeps GitHub’s own words where GitHub refuses the write', async () => {
    expect(
      await failureOf(new UpstreamError('remove', 'Not Found', 404, false)),
    ).toEqual(DeliveryFailure.of('github-rejected', 'remove: Not Found'));
  });

  it('passes any other error on as it is', async () => {
    const error = new TypeError('Cannot read properties of undefined');

    await expect(removing(error)).rejects.toBe(error);
  });

  it('posts a review on GitHub in GitHub’s terms, and answers in Change Review’s', async () => {
    const submit = vi.fn(() =>
      Promise.resolve({
        githubId: 900,
        postedAs: 'comment' as const,
        comments: [{ id: 100, url: 'https://github.com/c/100' }, null],
      }),
    );
    const posting = new GitHubReviewPosting(
      partial<PullRequestReviewsPort>({
        submit,
      }),
    );

    const posted = await posting.submit({
      workspaceId: WorkspaceId.of('workspace_1'),
      pullRequest: PullRequestUrl.of('https://github.com/acme/web/pull/7'),
      by: { kind: 'spotlight' },
      verdict: 'request-changes',
      body: 'Please fix',
      comments: [
        { path: 'a.ts', side: 'new', line: 3, startLine: null, body: 'Here' },
      ],
    });

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'request-changes',
        by: { kind: 'spotlight' },
        comments: [
          { path: 'a.ts', side: 'new', line: 3, startLine: null, body: 'Here' },
        ],
      }),
    );
    expect(posted).toEqual({
      githubId: 900,
      verdict: 'comment',
      comments: [{ id: 100, url: 'https://github.com/c/100' }, null],
    });
  });

  it('replies to a thread as a reply to GitHub’s comment', async () => {
    const reply = vi.fn(() =>
      Promise.resolve({ id: 5, url: 'https://github.com/c/5' }),
    );

    await new GitHubReviewPosting(
      partial<PullRequestReviewsPort>({
        reply,
      }),
    ).reply({
      workspaceId: WorkspaceId.of('workspace_1'),
      pullRequest: PullRequestUrl.of('https://github.com/acme/web/pull/7'),
      by: { kind: 'spotlight' },
      thread: 77,
      body: 'Done',
    });

    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ to: 77, body: 'Done' }),
    );
  });
});
