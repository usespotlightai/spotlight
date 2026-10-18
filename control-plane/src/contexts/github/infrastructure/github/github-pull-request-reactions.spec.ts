import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubPullRequestReactions } from '@github/infrastructure/github/github-pull-request-reactions';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

interface SentRequest {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

const ON = {
  workspaceId: WorkspaceId.of('ws_1'),
  pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
};

const REACTIONS = 'https://api.github.com/repos/acme/api/issues/7/reactions';

const reacting = (
  answer: (request: SentRequest) => { status: number; body?: unknown },
) => {
  const requests: SentRequest[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    const request = {
      url,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : null,
    };
    requests.push(request);
    const { status, body } = answer(request);

    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    });
  }) as typeof globalThis.fetch;

  const reactions = new GitHubPullRequestReactions(
    {
      credential: async () => ({ username: 'x-access-token', password: 'app' }),
    } as unknown as RepositoryAccessPort,
    fetch,
  );

  return { reactions, requests };
};

describe('GitHubPullRequestReactions', () => {
  it('reacts to the pull request’s own description', async () => {
    const { reactions, requests } = reacting(() => ({
      status: 201,
      body: { id: 5 },
    }));

    await reactions.react(ON, 'eyes');

    expect(requests).toEqual([
      { url: REACTIONS, method: 'POST', body: { content: 'eyes' } },
    ]);
  });

  it('takes back the reaction it added, found by adding it again', async () => {
    const { reactions, requests } = reacting(({ method }) =>
      method === 'POST' ? { status: 200, body: { id: 5 } } : { status: 204 },
    );

    await reactions.remove(ON, 'eyes');

    expect(requests.map((each) => `${each.method} ${each.url}`)).toEqual([
      `POST ${REACTIONS}`,
      `DELETE ${REACTIONS}/5`,
    ]);
  });

  it('takes nothing amiss where the reaction is already gone', async () => {
    const { reactions } = reacting(({ method }) =>
      method === 'POST' ? { status: 201, body: { id: 5 } } : { status: 404 },
    );

    await expect(reactions.remove(ON, 'eyes')).resolves.toBeUndefined();
  });

  it('says so where GitHub answers the reaction with an error', async () => {
    const { reactions } = reacting(() => ({ status: 403, body: {} }));

    await expect(reactions.react(ON, 'eyes')).rejects.toThrow(UpstreamError);
  });
});
