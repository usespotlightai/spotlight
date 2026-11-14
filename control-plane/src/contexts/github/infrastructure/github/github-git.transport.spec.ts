import { GitHubUnansweredError } from '@github/application/errors/github-unanswered.error';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubGitTransport } from '@github/infrastructure/github/github-git.transport';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const REPOSITORY = Repository.of('acme/docs');

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const logger = {
  warn: vi.fn(),
} as unknown as LoggerPort;

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
      vi.fn(async () => {
        throw Object.assign(new TypeError('fetch failed'), { cause });
      }),
    );

    const failure = await new GitHubGitTransport(access, logger)
      .call(WORKSPACE, REPOSITORY, CALL)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GitHubUnansweredError);
    expect((failure as GitHubUnansweredError).kind).toBe('upstream-error');
    expect((failure as GitHubUnansweredError).cause).toBeInstanceOf(TypeError);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('returns the answer and drops the caller authorization', async () => {
    const fetcher = vi.fn(async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'x-git-result' }),
      body: null,
    }));
    vi.stubGlobal('fetch', fetcher);

    const answer = await new GitHubGitTransport(access, logger).call(
      WORKSPACE,
      REPOSITORY,
      CALL,
    );

    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(answer).toEqual({
      status: 200,
      headers: { 'content-type': 'x-git-result' },
      body: null,
    });
    expect((init.headers as Record<string, string>).authorization).toMatch(
      /^Basic /,
    );
  });
});
