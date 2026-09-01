import type { RemarkAnswer } from '@application/ports/remarks.port';
import { InvalidPullRequestError } from '@domain/exceptions/invalid-pull-request.error';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { Remark } from '@domain/value-objects/remark.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { GitHubRemarks } from '@infrastructure/github/github-remarks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: async () => ({ username: 'x', password: 'token' }),
};

const answering = (over: Partial<RemarkAnswer> = {}): RemarkAnswer => ({
  repository: Repository.of('acme/widgets'),
  pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
  remark: Remark.of('PRRC_one'),
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

// What each call was asked to do, in order, so a test can say what happened.
let asked: { url: string; body: unknown }[] = [];
let replies: unknown[] = [];

const fetching = () =>
  vi.fn(async (url: string, init?: { body?: string }) => {
    asked.push({ url, body: JSON.parse(init?.body ?? '{}') });

    return {
      ok: true,
      status: 200,
      json: async () => replies.shift() ?? { data: {} },
    } as unknown as Response;
  });

const queried = () =>
  asked
    .filter((each) => each.url.endsWith('/graphql'))
    .map((each) => each.body);

const named = (query: string) =>
  queried().filter((each) =>
    ((each as { query?: string }).query ?? '').includes(query),
  );

describe('GitHubRemarks', () => {
  beforeEach(() => {
    asked = [];
    replies = [];
    vi.stubGlobal('fetch', fetching());
  });

  afterEach(() => vi.unstubAllGlobals());

  const remarks = () => new GitHubRemarks(access);

  it('answers within the thread the remark stands in', async () => {
    replies = [
      answered([
        thread({ id: 'PRRT_other', comments: { nodes: [] } }),
        thread(),
      ]),
    ];

    await remarks().answer(answering());

    expect(named('addPullRequestReviewThreadReply')).toHaveLength(1);
    expect(named('addPullRequestReviewThreadReply')[0]).toMatchObject({
      variables: { thread: 'PRRT_one', body: 'Split out in 4a1c2b0.' },
    });
    expect(named('resolveReviewThread')).toHaveLength(0);
  });

  it('resolves the thread as well where it was asked to', async () => {
    replies = [answered([thread()])];

    await remarks().answer(answering({ resolve: true }));

    expect(named('resolveReviewThread')[0]).toMatchObject({
      variables: { thread: 'PRRT_one' },
    });
  });

  it('leaves a thread somebody already resolved alone', async () => {
    replies = [answered([thread({ isResolved: true })])];

    await remarks().answer(answering({ resolve: true }));

    expect(named('resolveReviewThread')).toHaveLength(0);
  });

  // A run that answered and then failed to write it down must not answer
  // again on the thread.
  it('says nothing twice where the same answer already stands', async () => {
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

    await remarks().answer(answering());

    expect(named('addPullRequestReviewThreadReply')).toHaveLength(0);
  });

  describe('said on the pull request rather than on a line of it', () => {
    it('answers it as a comment, there being no thread', async () => {
      replies = [answered([])];

      await remarks().answer(answering());

      expect(asked[1]?.url).toContain('/issues/7/comments');
      expect(asked[1]?.body).toEqual({ body: 'Split out in 4a1c2b0.' });
    });

    it('refuses to resolve what stands in no thread', async () => {
      replies = [answered([])];

      await expect(
        remarks().answer(answering({ resolve: true })),
      ).rejects.toThrow(UpstreamRefusedError);
    });
  });

  it('refuses an address that names no pull request', async () => {
    replies = [answered([thread()])];

    await expect(
      remarks().answer(
        answering({
          pullRequest: PullRequestUrl.of('https://github.com/acme/widgets'),
        }),
      ),
    ).rejects.toThrow(InvalidPullRequestError);
  });

  it('carries back what the host refused, so the agent can read it', async () => {
    replies = [
      { errors: [{ message: 'Resource not accessible by integration' }] },
    ];

    await expect(remarks().answer(answering())).rejects.toThrow(
      /Resource not accessible/,
    );
  });
});
