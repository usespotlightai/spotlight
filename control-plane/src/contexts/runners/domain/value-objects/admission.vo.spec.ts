import { Admission } from '@runners/domain/value-objects/admission.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

describe('Admission', () => {
  it('names the pool a runner came in through', () => {
    const pooled = Admission.through(RunnerPoolId.of('pool_1'));

    expect([pooled.kind, pooled.id]).toEqual(['pool', 'pool_1']);
    expect(pooled.poolId?.value).toBe('pool_1');
    expect(pooled.trustId).toBeNull();
  });

  it('names the trust a runner came in through', () => {
    const trusted = Admission.through(RunnerTrustId.of('trust_1'));

    expect([trusted.kind, trusted.id]).toEqual(['trust', 'trust_1']);
    expect(trusted.trustId?.value).toBe('trust_1');
    expect(trusted.poolId).toBeNull();
  });

  it('is read back as the way it was stored', () => {
    expect(
      Admission.of('pool', 'pool_1').equals(
        Admission.through(RunnerPoolId.of('pool_1')),
      ),
    ).toBe(true);
    expect(
      Admission.of('trust', 'trust_1').equals(
        Admission.through(RunnerTrustId.of('trust_1')),
      ),
    ).toBe(true);
  });

  it('refuses a way in that is neither a pool nor a trust', () => {
    expect(() => Admission.of('runner', 'runner_1')).toThrow(
      InconsistentStateError,
    );
  });

  it('is another admission through another way, or the same id of another kind', () => {
    const pooled = Admission.of('pool', 'way_1');

    expect(pooled.equals(Admission.of('pool', 'way_2'))).toBe(false);
    expect(pooled.equals(Admission.of('trust', 'way_1'))).toBe(false);
  });
});
