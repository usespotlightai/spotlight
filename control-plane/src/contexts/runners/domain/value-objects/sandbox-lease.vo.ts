import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export type SandboxLeaseKind = 'run' | 'editor';

export const SANDBOX_LEASE_KINDS: readonly SandboxLeaseKind[] = [
  'run',
  'editor',
];

export class SandboxLease {
  private constructor(
    readonly kind: SandboxLeaseKind,
    readonly holder: string,
    readonly renewedAt: Date,
  ) {}

  static of(
    kind: SandboxLeaseKind,
    holder: string,
    renewedAt: Date,
  ): SandboxLease {
    if (holder.trim().length === 0) {
      throw new InconsistentStateError('sandbox lease', 'has no holder');
    }

    return new SandboxLease(kind, holder, renewedAt);
  }

  static forRun(runId: string, at: Date): SandboxLease {
    return SandboxLease.of('run', runId, at);
  }

  isHeldBy(kind: SandboxLeaseKind, holder: string): boolean {
    return this.kind === kind && this.holder === holder;
  }
}
