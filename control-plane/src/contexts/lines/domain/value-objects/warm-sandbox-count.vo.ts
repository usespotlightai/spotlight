import { InvalidWarmSandboxCountError } from '@lines/domain/exceptions/invalid-warm-sandbox-count.error';

const MOST = 5;

export class WarmSandboxCount {
  static readonly NONE = new WarmSandboxCount(0);

  private constructor(readonly value: number) {}

  static of(count: number): WarmSandboxCount {
    if (!Number.isInteger(count) || count < 0 || count > MOST) {
      throw new InvalidWarmSandboxCountError(
        `must be a whole number from 0 to ${MOST}`,
      );
    }

    return count === 0 ? WarmSandboxCount.NONE : new WarmSandboxCount(count);
  }

  get isNone(): boolean {
    return this.value === 0;
  }

  equals(other: WarmSandboxCount): boolean {
    return this.value === other.value;
  }
}
