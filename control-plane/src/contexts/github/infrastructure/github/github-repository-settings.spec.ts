import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubRepositorySettings } from '@github/infrastructure/github/github-repository-settings';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const workspaceId = WorkspaceId.of('ws_1');

const repository = Repository.of('acme/config');

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly body: Record<string, unknown>;
}

interface Answer {
  readonly status: number;
  readonly body?: unknown;
}

let sent: Sent[] = [];

const answering = ({ status, body = {} }: Answer) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const routing = (route: (method: string, url: string) => Answer) =>
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';

    sent.push({
      url,
      method,
      body: init.body ? JSON.parse(String(init.body)) : {},
    });

    return answering(route(method, url));
  });

const branch = (over: { protected?: boolean; rules?: unknown[] } = {}) =>
  routing((_, url) => {
    if (url.endsWith('/repos/acme/config')) {
      return { status: 200, body: { default_branch: 'main' } };
    }
    if (url.endsWith('/repos/acme/config/branches/main')) {
      return { status: 200, body: { protected: over.protected ?? false } };
    }
    if (url.endsWith('/rules/branches/main')) {
      return { status: 200, body: over.rules ?? [] };
    }

    return { status: 404, body: { message: `unrouted ${url}` } };
  });

const variables = (existing: readonly string[], patchStatus?: number) =>
  routing((method, url) => {
    const name = url.split('/actions/variables/')[1];

    if (method === 'PATCH' && patchStatus) {
      return { status: patchStatus, body: { message: 'Refused' } };
    }
    if (method === 'PATCH' && name) {
      return existing.includes(name)
        ? { status: 204 }
        : { status: 404, body: { message: 'Not Found' } };
    }
    if (method === 'POST' && url.endsWith('/actions/variables')) {
      return { status: 201 };
    }

    return { status: 404, body: { message: `unrouted ${url}` } };
  });

describe('GitHubRepositorySettings', () => {
  beforeEach(() => {
    sent = [];
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('reading the default branch', () => {
    it('counts classic branch protection as protected', async () => {
      branch({ protected: true });

      expect(
        await new GitHubRepositorySettings(access).defaultBranchOf(
          workspaceId,
          repository,
        ),
      ).toEqual({ name: 'main', protected: true });
    });

    it('counts a ruleset that requires a pull request as protected', async () => {
      branch({
        rules: [{ type: 'deletion' }, { type: 'pull_request' }],
      });

      expect(
        await new GitHubRepositorySettings(access).defaultBranchOf(
          workspaceId,
          repository,
        ),
      ).toEqual({ name: 'main', protected: true });
    });

    it('answers unprotected when neither applies', async () => {
      branch({ rules: [{ type: 'deletion' }] });

      expect(
        await new GitHubRepositorySettings(access).defaultBranchOf(
          workspaceId,
          repository,
        ),
      ).toEqual({ name: 'main', protected: false });
    });

    it('carries GitHub’s error when a read fails', async () => {
      routing(() => ({ status: 404, body: { message: 'Not Found' } }));

      await expect(
        new GitHubRepositorySettings(access).defaultBranchOf(
          workspaceId,
          repository,
        ),
      ).rejects.toThrow(
        'GitHub would not return the default branch of acme/config: Not Found',
      );
    });
  });

  describe('putting Actions variables', () => {
    it('creates a variable that is missing', async () => {
      variables([]);

      expect(
        await new GitHubRepositorySettings(access).putVariables(
          workspaceId,
          repository,
          { SPOTLIGHT_TRUST: 'trust_1' },
        ),
      ).toBe('written');

      expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
        'PATCH https://api.github.com/repos/acme/config/actions/variables/SPOTLIGHT_TRUST',
        'POST https://api.github.com/repos/acme/config/actions/variables',
      ]);
      expect(sent[1]?.body).toEqual({
        name: 'SPOTLIGHT_TRUST',
        value: 'trust_1',
      });
    });

    it('updates a variable that is present', async () => {
      variables(['SPOTLIGHT_TRUST', 'SPOTLIGHT_URL']);

      expect(
        await new GitHubRepositorySettings(access).putVariables(
          workspaceId,
          repository,
          { SPOTLIGHT_TRUST: 'trust_1', SPOTLIGHT_URL: 'https://x.test' },
        ),
      ).toBe('written');

      expect(sent.map(({ method }) => method)).toEqual(['PATCH', 'PATCH']);
      expect(sent[1]?.body).toEqual({
        name: 'SPOTLIGHT_URL',
        value: 'https://x.test',
      });
    });

    it('answers not-permitted on 403 and stops', async () => {
      variables([], 403);

      expect(
        await new GitHubRepositorySettings(access).putVariables(
          workspaceId,
          repository,
          { SPOTLIGHT_TRUST: 'trust_1', SPOTLIGHT_URL: 'https://x.test' },
        ),
      ).toBe('not-permitted');

      expect(sent).toHaveLength(1);
    });

    it('throws on any other failure', async () => {
      variables([], 500);

      await expect(
        new GitHubRepositorySettings(access).putVariables(
          workspaceId,
          repository,
          { SPOTLIGHT_TRUST: 'trust_1' },
        ),
      ).rejects.toThrow(
        'GitHub would not set the Actions variable SPOTLIGHT_TRUST of acme/config: Refused',
      );
    });
  });
});
