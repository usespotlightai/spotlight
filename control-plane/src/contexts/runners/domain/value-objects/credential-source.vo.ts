import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';

export type CredentialSourceKind = 'pool' | 'trust';

export class CredentialSource {
  private constructor(
    readonly kind: CredentialSourceKind,
    readonly id: string,
  ) {}

  static ofId(id: PoolId | RunnerTrustId): CredentialSource {
    return id instanceof PoolId
      ? new CredentialSource('pool', id.value)
      : new CredentialSource('trust', id.value);
  }

  static of(kind: string, id: string): CredentialSource {
    if (kind === 'pool') {
      return CredentialSource.ofId(PoolId.of(id));
    }
    if (kind === 'trust') {
      return CredentialSource.ofId(RunnerTrustId.of(id));
    }

    throw new InconsistentStateError(
      'credential source',
      `names a kind that is neither a pool nor a trust (${kind})`,
    );
  }

  get poolId(): PoolId | null {
    return this.kind === 'pool' ? PoolId.of(this.id) : null;
  }

  get trustId(): RunnerTrustId | null {
    return this.kind === 'trust' ? RunnerTrustId.of(this.id) : null;
  }

  equals(other: CredentialSource): boolean {
    return this.kind === other.kind && this.id === other.id;
  }
}
