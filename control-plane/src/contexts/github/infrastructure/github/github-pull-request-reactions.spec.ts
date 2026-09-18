import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubPullRequestReactions } from '@github/infrastructure/github/github-pull-request-reactions';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

interface Asked {
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
  answer: (asked: Asked) => { status: number; body?: unknown },
) => {
  const asked: Asked[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    const request = {
      url,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : null,
    };
    asked.push(request);
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

  return { reactions, asked };
};

describe('GitHubPullRequestReactions', () => {
  it('reacts to the pull request’s own description', async () => {
    const { reactions, asked } = reacting(() => ({
      status: 201,
      body: { id: 5 },
    }));

    await reactions.react(ON, 'eyes');

    expect(asked).toEqual([
      { url: REACTIONS, method: 'POST', body: { content: 'eyes' } },
    ]);
  });

  it('takes back the reaction it gave, found by giving it again', async () => {
    const { reactions, asked } = reacting(({ method }) =>
      method === 'POST' ? { status: 200, body: { id: 5 } } : { status: 204 },
    );

    await reactions.withdraw(ON, 'eyes');

    expect(asked.map((each) => `${each.method} ${each.url}`)).toEqual([
      `POST ${REACTIONS}`,
      `DELETE ${REACTIONS}/5`,
    ]);
  });

  it('takes nothing amiss where the reaction is already gone', async () => {
    const { reactions } = reacting(({ method }) =>
      method === 'POST' ? { status: 201, body: { id: 5 } } : { status: 404 },
    );

    await expect(reactions.withdraw(ON, 'eyes')).resolves.toBeUndefined();
  });

  it('says so where GitHub refuses the reaction', async () => {
    const { reactions } = reacting(() => ({ status: 403, body: {} }));

    await expect(reactions.react(ON, 'eyes')).rejects.toThrow(
      UpstreamRefusedError,
    );
  });
});
