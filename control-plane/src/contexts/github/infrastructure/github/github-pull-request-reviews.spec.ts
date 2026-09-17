import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubPullRequestReviews } from '@github/infrastructure/github/github-pull-request-reviews';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface Asked {
  readonly url: string;
  readonly method: string;
  readonly token: string;
  readonly body: Record<string, unknown> | null;
}

const ON = {
  workspaceId: WorkspaceId.of('ws_1'),
  pullRequest: PullRequestUrl.of('https://github.com/acme/web/pull/7'),
  by: { userId: UserId.of('user_ada'), name: 'Ada' },
};

const answering = (
  reply: (asked: Asked) => { status: number; body: unknown },
) => {
  const asked: Asked[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const request: Asked = {
        url,
        method: init.method ?? 'GET',
        token: String(
          (init.headers as Record<string, string>).authorization,
        ).replace('Bearer ', ''),
        body: init.body ? JSON.parse(String(init.body)) : null,
      };
      asked.push(request);
      const { status, body } = reply(request);

      return new Response(JSON.stringify(body), { status });
    }),
  );

  return asked;
};

const reviews = (personal: string | null) =>
  new GitHubPullRequestReviews(
    {
      credential: async () => ({ username: 'x-access-token', password: 'app' }),
    } as unknown as RepositoryAccessPort,
    { tokenFor: async () => personal },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

const COMMENTS = [
  {
    path: 'src/a.ts',
    side: 'new' as const,
    line: 3,
    startLine: 1,
    body: 'Rename',
  },
  {
    path: 'src/b.ts',
    side: 'old' as const,
    line: 8,
    startLine: null,
    body: 'Why remove?',
  },
];

describe('GitHubPullRequestReviews', () => {
  it('submits a review as the person, on the head of the pull request', async () => {
    const asked = answering(({ url, method }) => {
      if (method === 'GET' && url.endsWith('/pulls/7')) {
        return { status: 200, body: { head: { sha: 'abc123' } } };
      }
      if (method === 'POST') {
        return { status: 200, body: { id: 900, html_url: 'r' } };
      }
      return {
        status: 200,
        body: [
          {
            id: 12,
            html_url: 'c12',
            path: 'src/b.ts',
            line: 8,
            side: 'LEFT',
            body: 'Why remove?',
          },
          {
            id: 11,
            html_url: 'c11',
            path: 'src/a.ts',
            line: 3,
            side: 'RIGHT',
            body: 'Rename',
          },
        ],
      };
    });

    const submitted = await reviews('personal').submit({
      ...ON,
      verdict: 'request-changes',
      body: 'Two things',
      comments: COMMENTS,
    });

    const posted = asked.find((each) => each.method === 'POST');
    expect(posted?.url).toBe(
      'https://api.github.com/repos/acme/web/pulls/7/reviews',
    );
    expect(posted?.token).toBe('personal');
    expect(posted?.body).toEqual({
      commit_id: 'abc123',
      event: 'REQUEST_CHANGES',
      body: 'Two things',
      comments: [
        {
          path: 'src/a.ts',
          line: 3,
          side: 'RIGHT',
          start_line: 1,
          start_side: 'RIGHT',
          body: 'Rename',
        },
        { path: 'src/b.ts', line: 8, side: 'LEFT', body: 'Why remove?' },
      ],
    });
    expect(submitted).toEqual({
      githubId: 900,
      comments: [
        { id: 11, url: 'c11' },
        { id: 12, url: 'c12' },
      ],
    });
  });

  it('folds the comments into the review where GitHub will not place them on lines', async () => {
    const asked = answering(({ method, body }) => {
      if (method === 'GET') {
        return { status: 200, body: { head: { sha: 'abc123' } } };
      }
      return ((body?.comments ?? []) as unknown[]).length > 0
        ? { status: 422, body: { message: 'Line could not be resolved' } }
        : { status: 200, body: { id: 901, html_url: 'r' } };
    });

    const submitted = await reviews('personal').submit({
      ...ON,
      verdict: 'comment',
      body: '',
      comments: COMMENTS,
    });

    const [, , folded] = asked;
    expect(folded?.body?.comments).toEqual([]);
    expect(folded?.body?.body).toContain('`src/a.ts` lines 1–3');
    expect(folded?.body?.body).toContain('`src/b.ts` line 8');
    expect(folded?.body?.body).toContain('Why remove?');
    expect(submitted).toEqual({ githubId: 901, comments: [null, null] });
  });

  it('speaks as Spotlight, naming the person, where their own token is refused', async () => {
    const asked = answering(({ token }) =>
      token === 'personal'
        ? { status: 403, body: { message: 'Resource not accessible' } }
        : { status: 201, body: { id: 555, html_url: 'c555' } },
    );

    const posted = await reviews('personal').reply({
      ...ON,
      to: 77,
      body: 'Done',
    });

    expect(asked.map((each) => each.token)).toEqual(['personal', 'app']);
    expect(asked[1]?.url).toBe(
      'https://api.github.com/repos/acme/web/pulls/7/comments/77/replies',
    );
    expect(asked[1]?.body).toEqual({ body: '**Ada** via Spotlight:\n\nDone' });
    expect(posted).toEqual({ id: 555, url: 'c555' });
  });

  it('speaks as Spotlight where the person never signed in with GitHub', async () => {
    const asked = answering(() => ({ status: 200, body: {} }));

    await reviews(null).edit({ ...ON, commentId: 77, body: 'Clearer' });

    expect(asked).toEqual([
      {
        url: 'https://api.github.com/repos/acme/web/pulls/comments/77',
        method: 'PATCH',
        token: 'app',
        body: { body: '**Ada** via Spotlight:\n\nClearer' },
      },
    ]);
  });

  it('counts deleting a comment GitHub no longer has as done', async () => {
    answering(() => ({ status: 404, body: {} }));

    await expect(
      reviews(null).remove({ ...ON, commentId: 77 }),
    ).resolves.toBeUndefined();
  });

  it('passes on any other refusal', async () => {
    answering(() => ({ status: 500, body: { message: 'Server Error' } }));

    await expect(
      reviews('personal').edit({ ...ON, commentId: 77, body: 'x' }),
    ).rejects.toThrow(UpstreamRefusedError);
  });
});
