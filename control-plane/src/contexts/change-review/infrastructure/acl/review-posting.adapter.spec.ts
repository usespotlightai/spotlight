import { ReviewPostingFailedError } from '@change-review/application/errors/review-posting-failed.error';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { GitHubReviewPosting } from '@change-review/infrastructure/acl/review-posting.adapter';
import { GitHubUnansweredError } from '@github/application/errors/github-unanswered.error';
import type { PullRequestReviewsPort } from '@github/application/ports/pull-request-reviews.port';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const removing = (error: unknown) =>
  new GitHubReviewPosting({
    remove: async () => {
      throw error;
    },
  } as unknown as PullRequestReviewsPort).remove({
    workspaceId: WorkspaceId.of('workspace_1'),
    pullRequest: PullRequestUrl.of('https://github.com/acme/web/pull/7'),
    by: { kind: 'spotlight' },
    commentId: 1,
  });

const failureOf = async (error: unknown): Promise<DeliveryFailure> => {
  const caught = await removing(error).catch((thrown: unknown) => thrown);

  expect(caught).toBeInstanceOf(ReviewPostingFailedError);

  return (caught as ReviewPostingFailedError).failure;
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
    const outcomeUnknown = async (error: unknown) =>
      (
        (await removing(error).catch(
          (thrown: unknown) => thrown,
        )) as ReviewPostingFailedError
      ).outcomeUnknown;

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
});
