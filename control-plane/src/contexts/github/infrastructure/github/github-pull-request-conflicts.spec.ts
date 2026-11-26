import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubPullRequestConflicts } from '@github/infrastructure/github/github-pull-request-conflicts';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const answering = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const pull = (number: number, mergeable: boolean | null) => ({
  html_url: `https://github.com/acme/api/pull/${number}`,
  mergeable,
  head: { ref: `spotlight/task_${number}` },
});

const github = (reads: Record<number, readonly (boolean | null)[]>) => {
  const sent: string[] = [];
  const asked = new Map<number, number>();

  vi.stubGlobal('fetch', async (url: string) => {
    sent.push(url);

    if (url.includes('/pulls?state=open')) {
      return answering(
        200,
        Object.keys(reads).map((number) => ({ number: Number(number) })),
      );
    }

    const number = Number(/\/pulls\/(\d+)$/.exec(url)?.[1]);
    const times = asked.get(number) ?? 0;
    const answers = reads[number] ?? [];
    asked.set(number, times + 1);

    return answering(
      200,
      pull(number, answers[Math.min(times, answers.length - 1)] ?? null),
    );
  });

  return sent;
};

const conflicts = () => {
  const clock = { sleep: vi.fn(async () => {}) };

  return {
    clock,
    found: (base = 'main') =>
      new GitHubPullRequestConflicts(access, clock).conflictingWith(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/api'),
        base,
      ),
  };
};

describe('GitHubPullRequestConflicts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('finds the open pull requests into the branch that GitHub cannot merge', async () => {
    const sent = github({ 17: [true], 18: [false] });
    const { found, clock } = conflicts();

    expect(await found()).toEqual([
      {
        url: 'https://github.com/acme/api/pull/18',
        branch: 'spotlight/task_18',
      },
    ]);
    expect(sent[0]).toBe(
      'https://api.github.com/repos/acme/api/pulls?state=open&base=main&per_page=100',
    );
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it('reads a pull request again while GitHub still computes whether it merges', async () => {
    const sent = github({ 17: [true], 18: [null, null, false] });
    const { found, clock } = conflicts();

    expect(await found()).toEqual([
      expect.objectContaining({ url: 'https://github.com/acme/api/pull/18' }),
    ]);
    expect(clock.sleep).toHaveBeenCalledTimes(2);
    expect(sent.filter((url) => url.endsWith('/pulls/17'))).toHaveLength(1);
  });

  it('stops reading a pull request GitHub has not computed after three reads', async () => {
    const sent = github({ 18: [null] });
    const { found } = conflicts();

    expect(await found()).toEqual([]);
    expect(sent.filter((url) => url.endsWith('/pulls/18'))).toHaveLength(3);
  });

  it('names the base branch as GitHub needs it in the query', async () => {
    const sent = github({});

    expect(await conflicts().found('release/2.0')).toEqual([]);
    expect(sent[0]).toContain('base=release%2F2.0');
  });
});
