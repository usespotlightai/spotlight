import type { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';

export const EDITOR_LEASE_MS = 2 * 60_000;

const EDITOR_RENEWALS_PER_LEASE = 4;

export class SandboxLease {
  private constructor(
    readonly holder: LeaseHolder,
    readonly renewedAt: Date,
  ) {}

  static of(holder: LeaseHolder, renewedAt: Date): SandboxLease {
    return new SandboxLease(holder, renewedAt);
  }

  static editorRenewalMs(): number {
    return EDITOR_LEASE_MS / EDITOR_RENEWALS_PER_LEASE;
  }

  get isForRun(): boolean {
    return this.holder.isRun;
  }

  expiredAt(now: Date): boolean {
    return (
      this.holder.isEditor &&
      now.getTime() - this.renewedAt.getTime() >= EDITOR_LEASE_MS
    );
  }

  isHeldBy(holder: LeaseHolder): boolean {
    return this.holder.equals(holder);
  }
}
