import type { ReviewCommentReply } from '@github/application/ports/review-comments.port';
import { GitHubReviewComments } from '@github/infrastructure/github/github-review-comments';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: async () => ({ username: 'x', password: 'token' }),
};

const replying = (
  over: Partial<ReviewCommentReply> = {},
): ReviewCommentReply => ({
  workspaceId: WorkspaceId.of('ws_1'),
  repository: Repository.of('acme/widgets'),
  pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
  reviewComment: 'PRRC_one',
  body: 'Split out in 4a1c2b0.',
  resolve: false,
  ...over,
});

const thread = (over: Record<string, unknown> = {}) => ({
  id: 'PRRT_one',
  isResolved: false,
  comments: { nodes: [{ id: 'PRRC_one', body: 'pin this.' }] },
  ...over,
});

const answered = (nodes: unknown[]) => ({
  data: {
    repository: { pullRequest: { reviewThreads: { nodes } } },
  },
});

let requests: { url: string; body: unknown }[] = [];
let replies: unknown[] = [];

const fetching = () =>
  vi.fn(async (url: string, init?: { body?: string }) => {
    requests.push({ url, body: JSON.parse(init?.body ?? '{}') });

    return {
      ok: true,
      status: 200,
      json: async () => replies.shift() ?? { data: {} },
    } as unknown as Response;
  });

const queried = () =>
  requests
    .filter((each) => each.url.endsWith('/graphql'))
    .map((each) => each.body);

const named = (query: string) =>
  queried().filter((each) =>
    ((each as { query?: string }).query ?? '').includes(query),
  );

describe('GitHubReviewComments', () => {
  beforeEach(() => {
    requests = [];
    replies = [];
    vi.stubGlobal('fetch', fetching());
  });

  afterEach(() => vi.unstubAllGlobals());

  const reviewComments = () => new GitHubReviewComments(access);

  it('replies within the thread that holds the review comment', async () => {
    replies = [
      answered([
        thread({ id: 'PRRT_other', comments: { nodes: [] } }),
        thread(),
      ]),
    ];

    await reviewComments().reply(replying());

    expect(named('addPullRequestReviewThreadReply')).toHaveLength(1);
    expect(named('addPullRequestReviewThreadReply')[0]).toMatchObject({
      variables: { thread: 'PRRT_one', body: 'Split out in 4a1c2b0.' },
    });
    expect(named('resolveReviewThread')).toHaveLength(0);
  });

  it('resolves the thread as well where the reply requests it', async () => {
    replies = [answered([thread()])];

    await reviewComments().reply(replying({ resolve: true }));

    expect(named('resolveReviewThread')[0]).toMatchObject({
      variables: { thread: 'PRRT_one' },
    });
  });

  it('leaves a thread somebody already resolved alone', async () => {
    replies = [answered([thread({ isResolved: true })])];

    await reviewComments().reply(replying({ resolve: true }));

    expect(named('resolveReviewThread')).toHaveLength(0);
  });

  it('does not reply again where the same reply is already there', async () => {
    replies = [
      answered([
        thread({
          comments: {
            nodes: [
              { id: 'PRRC_one', body: 'pin this.' },
              { id: 'PRRC_two', body: 'Split out in 4a1c2b0.' },
            ],
          },
        }),
      ]),
    ];

    await reviewComments().reply(replying());

    expect(named('addPullRequestReviewThreadReply')).toHaveLength(0);
  });

  describe('on the pull request rather than on a line of it', () => {
    it('replies to it as a comment, there being no thread', async () => {
      replies = [answered([])];

      await reviewComments().reply(replying());

      expect(requests[1]?.url).toContain('/issues/7/comments');
      expect(requests[1]?.body).toEqual({ body: 'Split out in 4a1c2b0.' });
    });

    it('does not resolve what is in no thread', async () => {
      replies = [answered([])];

      await expect(
        reviewComments().reply(replying({ resolve: true })),
      ).rejects.toThrow(UpstreamError);
    });
  });

  it('rejects an address that names no pull request', async () => {
    replies = [answered([thread()])];

    await expect(
      reviewComments().reply(
        replying({
          pullRequest: PullRequestUrl.of('https://github.com/acme/widgets'),
        }),
      ),
    ).rejects.toThrow(InvalidPullRequestError);
  });

  it('carries back the error from GitHub, so the agent can read it', async () => {
    replies = [
      { errors: [{ message: 'Resource not accessible by integration' }] },
    ];

    await expect(reviewComments().reply(replying())).rejects.toThrow(
      /Resource not accessible/,
    );
  });
});
