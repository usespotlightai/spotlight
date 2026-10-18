import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

describe('CredentialSource', () => {
  it('names the pool a runner came in through', () => {
    const pooled = CredentialSource.ofId(RunnerPoolId.of('pool_1'));

    expect([pooled.kind, pooled.id]).toEqual(['pool', 'pool_1']);
    expect(pooled.poolId?.value).toBe('pool_1');
    expect(pooled.trustId).toBeNull();
  });

  it('names the trust a runner came in through', () => {
    const trusted = CredentialSource.ofId(RunnerTrustId.of('trust_1'));

    expect([trusted.kind, trusted.id]).toEqual(['trust', 'trust_1']);
    expect(trusted.trustId?.value).toBe('trust_1');
    expect(trusted.poolId).toBeNull();
  });

  it('is read back as the way it was stored', () => {
    expect(
      CredentialSource.of('pool', 'pool_1').equals(
        CredentialSource.ofId(RunnerPoolId.of('pool_1')),
      ),
    ).toBe(true);
    expect(
      CredentialSource.of('trust', 'trust_1').equals(
        CredentialSource.ofId(RunnerTrustId.of('trust_1')),
      ),
    ).toBe(true);
  });

  it('rejects a kind that is neither a pool nor a trust', () => {
    expect(() => CredentialSource.of('runner', 'runner_1')).toThrow(
      InconsistentStateError,
    );
  });

  it('is another credential source for another id, or the same id of another kind', () => {
    const pooled = CredentialSource.of('pool', 'way_1');

    expect(pooled.equals(CredentialSource.of('pool', 'way_2'))).toBe(false);
    expect(pooled.equals(CredentialSource.of('trust', 'way_1'))).toBe(false);
  });
});
