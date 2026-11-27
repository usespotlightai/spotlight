import { GitHubUnansweredError } from '@github/application/errors/github-unanswered.error';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubGitTransport } from '@github/infrastructure/github/github-git.transport';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const REPOSITORY = Repository.of('acme/docs');

const access = partial<RepositoryAccessPort>({
  credential: vi.fn(() =>
    Promise.resolve({
      username: 'x-access-token',
      password: 'tok_1',
    }),
  ),
});

const logger = partial<LoggerPort>({
  warn: vi.fn(),
});

const CALL = {
  method: 'POST',
  path: '/git-upload-pack',
  search: '',
  headers: { authorization: 'Bearer runner', 'content-type': 'x-git' },
  body: null,
} as const;

describe('GitHubGitTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('throws GitHubUnansweredError with the cause when fetch fails', async () => {
    const cause = new Error('other side closed');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return Promise.reject(
          Object.assign(new TypeError('fetch failed'), { cause }),
        );
      }),
    );

    const failure = await new GitHubGitTransport(access, logger)
      .call(WORKSPACE, REPOSITORY, CALL)
      .catch((error: unknown) => error);

    if (!(failure instanceof GitHubUnansweredError)) {
      throw new Error('expected a GitHubUnansweredError');
    }
    expect(failure.kind).toBe('upstream-error');
    expect(failure.cause).toBeInstanceOf(TypeError);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('returns the answer and drops the caller authorization', async () => {
    const fetcher = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({
        status: 200,
        headers: new Headers({ 'content-type': 'x-git-result' }),
        body: null,
      }),
    );
    vi.stubGlobal('fetch', fetcher);

    const answer = await new GitHubGitTransport(access, logger).call(
      WORKSPACE,
      REPOSITORY,
      CALL,
    );

    const init = firstOf(fetcher.mock.calls)?.[1];
    expect(answer).toEqual({
      status: 200,
      headers: { 'content-type': 'x-git-result' },
      body: null,
    });
    expect(new Headers(init?.headers).get('authorization')).toMatch(/^Basic /);
  });
});
