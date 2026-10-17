import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { RunnerAuthenticator } from '@runners/application/services/runner-authenticator.service';
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
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type {
  ExpectedWorkload,
  WorkloadTokensPort,
} from '@shared-kernel/application/ports/workload-tokens.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const POOL_TOKEN = 'pool-token';

const WORKLOAD_TOKEN = 'workload-token';

const CLAIMS: WorkloadClaims = {
  issuer: 'https://oidc.example.com/cluster',
  subject: 'system:serviceaccount:spotlight:runner',
  audiences: ['spotlight'],
  named: {},
};

const authenticating = (
  input: {
    pool?: RunnerPool | null;
    trust?: RunnerTrust | null;
    claims?: WorkloadClaims | null;
    open?: boolean;
  } = {},
) => {
  const findByTokenHash = vi.fn(async (hash: TokenHash) =>
    hash.equals(hashOf('a'))
      ? input.pool === undefined
        ? aPullPool()
        : input.pool
      : null,
  );
  const verify = vi.fn(async (token: string, _expected: ExpectedWorkload) =>
    token === WORKLOAD_TOKEN
      ? input.claims === undefined
        ? CLAIMS
        : input.claims
      : null,
  );
  const isOpen = vi.fn(async () => input.open ?? true);

  const authenticator = new RunnerAuthenticator(
    { findByTokenHash } as unknown as RunnerPoolRepository,
    {
      find: vi.fn(async () =>
        input.trust === undefined ? aTrust() : input.trust,
      ),
    } as unknown as RunnerTrustRepository,
    { verify } as WorkloadTokensPort,
    { isOpen } as unknown as WorkspaceReaderPort,
    {
      issue: () => ({ token: 'unused', hash: 'unused' }),
      hash: (token: string) =>
        token === POOL_TOKEN ? 'a'.repeat(64) : 'f'.repeat(64),
    } as TokenIssuer,
  );

  return { authenticator, findByTokenHash, verify, isOpen };
};

const pooled = { bearer: POOL_TOKEN, trust: undefined };

const trusted = { bearer: WORKLOAD_TOKEN, trust: TRUST_ID.value };

describe('RunnerAuthenticator', () => {
  describe('through a pool', () => {
    it('authenticates a host with the token a pull pool pulls with, to the pool’s workspace', async () => {
      await expect(
        authenticating().authenticator.authenticate(pooled),
      ).resolves.toEqual({
        source: expect.objectContaining({ kind: 'pool', id: POOL_ID.value }),
        workspaceId: WorkspaceId.of('ws_1'),
      });
    });

    it('authenticates no host with a token no pool pulls with', async () => {
      await expect(
        authenticating().authenticator.authenticate({
          bearer: 'stolen',
          trust: undefined,
        }),
      ).resolves.toBeNull();
    });

    it('authenticates no host to a pool that provisions its runners instead', async () => {
      await expect(
        authenticating({ pool: aPushPool() }).authenticator.authenticate(
          pooled,
        ),
      ).resolves.toBeNull();
    });

    it('authenticates no host to a pool that is deleted', async () => {
      await expect(
        authenticating({
          pool: aPullPool().delete(attributedIn()),
        }).authenticator.authenticate(pooled),
      ).resolves.toBeNull();
    });
  });

  describe('through a trust', () => {
    it('authenticates a workload whose token the trust’s issuer signed for it', async () => {
      const { authenticator, verify } = authenticating();

      await expect(authenticator.authenticate(trusted)).resolves.toEqual({
        source: expect.objectContaining({ kind: 'trust', id: TRUST_ID.value }),
        workspaceId: WorkspaceId.of('ws_1'),
      });
      expect(verify).toHaveBeenCalledWith(WORKLOAD_TOKEN, {
        issuer: 'https://oidc.example.com/cluster',
        audience: 'spotlight',
      });
    });

    it('never looks the workload token up as a pool’s', async () => {
      const { authenticator, findByTokenHash } = authenticating();

      await authenticator.authenticate(trusted);

      expect(findByTokenHash).not.toHaveBeenCalled();
    });

    it('authenticates no workload the trust does not name', async () => {
      await expect(
        authenticating({
          claims: { ...CLAIMS, subject: 'system:serviceaccount:other:pod' },
        }).authenticator.authenticate(trusted),
      ).resolves.toBeNull();
    });

    it('authenticates no token that does not verify', async () => {
      await expect(
        authenticating({ claims: null }).authenticator.authenticate(trusted),
      ).resolves.toBeNull();
    });

    it('authenticates nothing through a trust that is unknown or deleted', async () => {
      await expect(
        authenticating({ trust: null }).authenticator.authenticate(trusted),
      ).resolves.toBeNull();
      await expect(
        authenticating({
          trust: aTrust().delete(attributedIn()),
        }).authenticator.authenticate(trusted),
      ).resolves.toBeNull();
    });
  });

  it('authenticates nobody without a bearer token', async () => {
    const { authenticator, findByTokenHash, verify } = authenticating();

    await expect(
      authenticator.authenticate({ bearer: undefined, trust: TRUST_ID.value }),
    ).resolves.toBeNull();
    await expect(
      authenticator.authenticate({ bearer: '', trust: undefined }),
    ).resolves.toBeNull();
    expect(findByTokenHash).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('authenticates nobody to a workspace that is deleted', async () => {
    const { authenticator, isOpen } = authenticating({ open: false });

    await expect(authenticator.authenticate(pooled)).resolves.toBeNull();
    await expect(authenticator.authenticate(trusted)).resolves.toBeNull();
    expect(isOpen).toHaveBeenCalledWith('ws_1');
  });
});
