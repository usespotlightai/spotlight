import type { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';

export const EDITOR_LEASE_MS = 2 * 60_000;

export const ARCHIVE_LEASE_MS = 2 * 60_000;

const EDITOR_RENEWALS_PER_LEASE = 4;

export class SandboxLease {
  private constructor(
    readonly holder: LeaseHolder,
    readonly renewedAt: Date,
  ) {}

  static of(holder: LeaseHolder, renewedAt: Date): SandboxLease {
    return new SandboxLease(holder, renewedAt);
  }

  static archiveRenewedBefore(now: Date): Date {
    return new Date(now.getTime() - ARCHIVE_LEASE_MS);
  }

  static editorRenewalMs(): number {
    return EDITOR_LEASE_MS / EDITOR_RENEWALS_PER_LEASE;
  }

  get isForRun(): boolean {
    return this.holder.isRun;
  }

  get isForEditor(): boolean {
    return this.holder.isEditor;
  }

  get isForArchive(): boolean {
    return this.holder.isArchive;
  }

  get occupies(): boolean {
    return this.holder.isRun || this.holder.isArchive;
  }

  expiredAt(now: Date): boolean {
    const held = now.getTime() - this.renewedAt.getTime();

    if (this.holder.isEditor) {
      return held >= EDITOR_LEASE_MS;
    }

    return this.holder.isArchive && held >= ARCHIVE_LEASE_MS;
  }

  isHeldBy(holder: LeaseHolder): boolean {
    return this.holder.equals(holder);
  }
}
