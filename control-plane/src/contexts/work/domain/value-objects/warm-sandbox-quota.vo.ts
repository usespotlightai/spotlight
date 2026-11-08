import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class WarmSandboxQuota {
  static readonly NONE = new WarmSandboxQuota(0);

  private constructor(readonly value: number) {}

  static of(count: number): WarmSandboxQuota {
    if (!Number.isInteger(count) || count < 0) {
      throw new InconsistentStateError(
        'line',
        `keeps an impossible number of warm sandboxes (${count})`,
      );
    }

    return count === 0 ? WarmSandboxQuota.NONE : new WarmSandboxQuota(count);
  }

  get isNone(): boolean {
    return this.value === 0;
  }

  equals(other: WarmSandboxQuota): boolean {
    return this.value === other.value;
  }
}
