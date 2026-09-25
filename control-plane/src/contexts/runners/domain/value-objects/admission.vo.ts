import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export type AdmissionKind = 'pool' | 'trust';

export class Admission {
  private constructor(
    readonly kind: AdmissionKind,
    readonly id: string,
  ) {}

  static through(way: RunnerPoolId | RunnerTrustId): Admission {
    return way instanceof RunnerPoolId
      ? new Admission('pool', way.value)
      : new Admission('trust', way.value);
  }

  static of(kind: string, id: string): Admission {
    if (kind === 'pool') {
      return Admission.through(RunnerPoolId.of(id));
    }
    if (kind === 'trust') {
      return Admission.through(RunnerTrustId.of(id));
    }

    throw new InconsistentStateError(
      'admission',
      `names a way in that is neither a pool nor a trust (${kind})`,
    );
  }

  get poolId(): RunnerPoolId | null {
    return this.kind === 'pool' ? RunnerPoolId.of(this.id) : null;
  }

  get trustId(): RunnerTrustId | null {
    return this.kind === 'trust' ? RunnerTrustId.of(this.id) : null;
  }

  equals(other: Admission): boolean {
    return this.kind === other.kind && this.id === other.id;
  }
}
