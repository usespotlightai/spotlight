import { GitHubPullRequestComments } from '@github/infrastructure/github/github-pull-request-comments';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const MARKER = '<!-- spotlight:change-stack -->';

const answering = (existing: { id: number; body: string }[]) => {
  const requests: { url: string; method: string; body: unknown }[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    requests.push({
      url,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : null,
    });
    return (init.method ?? 'GET') === 'GET'
      ? new Response(JSON.stringify(existing), { status: 200 })
      : new Response('{}', { status: 201 });
  }) as unknown as typeof globalThis.fetch;

  const comments = new GitHubPullRequestComments(
    {
      credential: async () => ({ username: 'x-access-token', password: 'tok' }),
    } as never,
    fetch,
  );

  return { requests, comments };
};

const upsert = (comments: GitHubPullRequestComments) =>
  comments.upsert({
    workspaceId: WorkspaceId.of('ws_1'),
    repository: Repository.of('acme/widgets'),
    pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/66'),
    marker: MARKER,
    body: 'The stack',
  });

describe('GitHubPullRequestComments', () => {
  it('comments once where Spotlight has not yet', async () => {
    const { requests, comments } = answering([{ id: 1, body: 'LGTM' }]);

    await upsert(comments);

    expect(requests[1]).toEqual({
      url: 'https://api.github.com/repos/acme/widgets/issues/66/comments',
      method: 'POST',
      body: { body: `${MARKER}\nThe stack` },
    });
  });

  it('edits its own comment rather than adding another', async () => {
    const { requests, comments } = answering([
      { id: 1, body: 'LGTM' },
      { id: 7, body: `${MARKER}\nAn older stack` },
    ]);

    await upsert(comments);

    expect(requests[1]).toMatchObject({
      url: 'https://api.github.com/repos/acme/widgets/issues/comments/7',
      method: 'PATCH',
    });
    expect(requests).toHaveLength(2);
  });

  it('deletes its own comment', async () => {
    const { requests, comments } = answering([
      { id: 1, body: 'LGTM' },
      { id: 7, body: `${MARKER}\nAn older stack` },
    ]);

    await comments.delete({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: Repository.of('acme/widgets'),
      pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/66'),
      marker: MARKER,
    });

    expect(requests[1]).toMatchObject({
      url: 'https://api.github.com/repos/acme/widgets/issues/comments/7',
      method: 'DELETE',
    });
  });

  it('deletes nothing where it never commented', async () => {
    const { requests, comments } = answering([{ id: 1, body: 'LGTM' }]);

    await comments.delete({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: Repository.of('acme/widgets'),
      pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/66'),
      marker: MARKER,
    });

    expect(requests).toHaveLength(1);
  });
});
