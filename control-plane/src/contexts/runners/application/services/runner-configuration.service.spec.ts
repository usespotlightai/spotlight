import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { RunnerConfiguration } from '@runners/application/services/runner-configuration.service';
import { aPullPool } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TRUST = RunnerTrustId.of('trust_1');

const trust = RunnerTrust.rehydrate({
  id: TRUST,
  workspaceId: WORKSPACE,
  key: TrustKey.of('production'),
  workload: TrustedWorkload.of({
    issuer: 'https://oidc.example.com',
    subject: 'runner',
    audience: 'spotlight',
  }),
  labels: RunnerLabels.of(['gpu']),
  version: 0,
});

const declared = WorkspaceRunners.rehydrate({
  id: WorkspaceRunnersId.of('declared_1'),
  workspaceId: WORKSPACE,
  trusts: [TrustKey.of('production')],
  pools: [PoolKey.of('ephemeral')],
  version: 0,
});

const pool = aPullPool({ maxRuns: 4, tokenVersion: 2 });

const configuration = new RunnerConfiguration(
  {
    inWorkspace: async () => [trust],
    find: async () => trust,
  } as unknown as RunnerTrustRepository,
  {
    declaredIn: async () => declared,
    find: async () => declared,
  } as unknown as WorkspaceRunnersRepository,
  { slugOf: async () => 'acme' } as unknown as WorkspaceReaderPort,
  {
    inWorkspace: async () => [pool],
    find: async () => pool,
  } as unknown as RunnerPoolRepository,
);

describe('RunnerConfiguration', () => {
  it('configures the trusts, the pools and the declaration', async () => {
    await expect(configuration.in(WORKSPACE)).resolves.toEqual({
      trusts: [
        {
          id: 'trust_1',
          address: 'production',
          workspaceId: WORKSPACE,
          key: 'production',
          issuer: 'https://oidc.example.com',
          subject: 'runner',
          audience: 'spotlight',
          labels: ['gpu'],
        },
      ],
      pools: [
        {
          id: 'pool_1',
          address: 'ephemeral',
          workspaceId: pool.workspaceId,
          key: 'ephemeral',
          labels: ['linux'],
          maxRuns: 4,
          tokenVersion: 2,
          provision: null,
        },
      ],
      declared: {
        id: 'declared_1',
        address: 'acme',
        workspaceId: WORKSPACE,
        trusts: ['production'],
        pools: ['ephemeral'],
      },
    });
  });

  it('configures each trust, pool and declaration by its id', async () => {
    await expect(configuration.trustWithId('trust_1')).resolves.toMatchObject({
      key: 'production',
    });
    await expect(configuration.poolWithId('pool_1')).resolves.toMatchObject({
      key: 'ephemeral',
    });
    await expect(
      configuration.declaredWithId('declared_1'),
    ).resolves.toMatchObject({ address: 'acme', trusts: ['production'] });
  });
});
