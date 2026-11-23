import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunCheckoutsMapper } from '@work/application/mappers/run-checkouts.mapper';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { describe, expect, it } from 'vitest';

describe('RunCheckoutsMapper', () => {
  it('sends checkouts to a runner through Spotlight’s git proxy, never by a host address', () => {
    expect(
      RunCheckoutsMapper.toRun([
        {
          repository: Repository.of('acme/api'),
          branch: Branch.of('feat/retries-12345678'),
          base: Branch.of('release/1.x'),
          ref: null,
          diffOf: 'worktree',
          setup: 'npm ci',
        },
        {
          repository: Repository.of('acme/web'),
          branch: null,
          base: null,
          ref: 'refs/pull/42/head',
          diffOf: 'commits',
          setup: null,
        },
      ]),
    ).toEqual([
      {
        remote: 'spotlight:repository',
        path: 'api',
        branch: 'feat/retries-12345678',
        base: 'release/1.x',
        setup: 'npm ci',
      },
      {
        remote: 'spotlight:repository',
        path: 'web',
        ref: 'refs/pull/42/head',
        diffOf: 'commits',
      },
    ]);
  });
});
