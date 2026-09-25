import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type {
  ExpectedWorkload,
  WorkloadTokensPort,
} from '@runners/application/ports/workload-tokens.port';
import { RunnerAdmissions } from '@runners/application/services/runner-admissions.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPullPool,
  aPushPool,
  aTrust,
  hashOf,
  POOL_ID,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkloadClaims } from '@runners/domain/value-objects/trusted-workload.vo';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const POOL_TOKEN = 'pool-token';

const WORKLOAD_TOKEN = 'workload-token';

const CLAIMS: WorkloadClaims = {
  issuer: 'https://oidc.example.com/cluster',
  subject: 'system:serviceaccount:spotlight:runner',
  audiences: ['spotlight'],
};

const admitting = (
  given: {
    pool?: RunnerPool | null;
    trust?: RunnerTrust | null;
    claims?: WorkloadClaims | null;
    open?: boolean;
  } = {},
) => {
  const findByTokenHash = vi.fn(async (hash: TokenHash) =>
    hash.equals(hashOf('a'))
      ? given.pool === undefined
        ? aPullPool()
        : given.pool
      : null,
  );
  const verify = vi.fn(async (token: string, _expected: ExpectedWorkload) =>
    token === WORKLOAD_TOKEN
      ? given.claims === undefined
        ? CLAIMS
        : given.claims
      : null,
  );
  const isOpen = vi.fn(async () => given.open ?? true);

  const admissions = new RunnerAdmissions(
    { findByTokenHash } as unknown as RunnerPoolRepository,
    {
      find: vi.fn(async () =>
        given.trust === undefined ? aTrust() : given.trust,
      ),
    } as unknown as RunnerTrustRepository,
    { verify } as WorkloadTokensPort,
    { isOpen } as unknown as WorkspaceReaderPort,
    {
      mint: () => ({ token: 'unused', hash: 'unused' }),
      hash: (token: string) =>
        token === POOL_TOKEN ? 'a'.repeat(64) : 'f'.repeat(64),
    } as TokenMintPort,
  );

  return { admissions, findByTokenHash, verify, isOpen };
};

const pooled = { bearer: POOL_TOKEN, trust: undefined };

const trusted = { bearer: WORKLOAD_TOKEN, trust: TRUST_ID.value };

describe('RunnerAdmissions', () => {
  describe('through a pool', () => {
    it('admits a host holding the token a pull pool pulls with, to the pool’s workspace', async () => {
      await expect(admitting().admissions.admit(pooled)).resolves.toEqual({
        way: expect.objectContaining({ kind: 'pool', id: POOL_ID.value }),
        workspaceId: WorkspaceId.of('ws_1'),
      });
    });

    it('admits no host with a token no pool pulls with', async () => {
      await expect(
        admitting().admissions.admit({ bearer: 'stolen', trust: undefined }),
      ).resolves.toBeNull();
    });

    it('admits no host to a pool that provisions its runners instead', async () => {
      await expect(
        admitting({ pool: aPushPool() }).admissions.admit(pooled),
      ).resolves.toBeNull();
    });

    it('admits no host to a pool that is retired', async () => {
      await expect(
        admitting({
          pool: aPullPool().retired(attributedIn()),
        }).admissions.admit(pooled),
      ).resolves.toBeNull();
    });
  });

  describe('through a trust', () => {
    it('admits a workload whose token the trust’s issuer signed for it', async () => {
      const { admissions, verify } = admitting();

      await expect(admissions.admit(trusted)).resolves.toEqual({
        way: expect.objectContaining({ kind: 'trust', id: TRUST_ID.value }),
        workspaceId: WorkspaceId.of('ws_1'),
      });
      expect(verify).toHaveBeenCalledWith(WORKLOAD_TOKEN, {
        issuer: 'https://oidc.example.com/cluster',
        audience: 'spotlight',
      });
    });

    it('never looks the workload token up as a pool’s', async () => {
      const { admissions, findByTokenHash } = admitting();

      await admissions.admit(trusted);

      expect(findByTokenHash).not.toHaveBeenCalled();
    });

    it('admits no workload the trust does not name', async () => {
      await expect(
        admitting({
          claims: { ...CLAIMS, subject: 'system:serviceaccount:other:pod' },
        }).admissions.admit(trusted),
      ).resolves.toBeNull();
    });

    it('admits no token that does not verify', async () => {
      await expect(
        admitting({ claims: null }).admissions.admit(trusted),
      ).resolves.toBeNull();
    });

    it('admits nothing through a trust that is unknown or withdrawn', async () => {
      await expect(
        admitting({ trust: null }).admissions.admit(trusted),
      ).resolves.toBeNull();
      await expect(
        admitting({
          trust: aTrust().withdrawn(attributedIn()),
        }).admissions.admit(trusted),
      ).resolves.toBeNull();
    });
  });

  it('admits nobody without a bearer token', async () => {
    const { admissions, findByTokenHash, verify } = admitting();

    await expect(
      admissions.admit({ bearer: undefined, trust: TRUST_ID.value }),
    ).resolves.toBeNull();
    await expect(
      admissions.admit({ bearer: '', trust: undefined }),
    ).resolves.toBeNull();
    expect(findByTokenHash).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('admits nobody to a workspace that is closed', async () => {
    const { admissions, isOpen } = admitting({ open: false });

    await expect(admissions.admit(pooled)).resolves.toBeNull();
    await expect(admissions.admit(trusted)).resolves.toBeNull();
    expect(isOpen).toHaveBeenCalledWith('ws_1');
  });
});
