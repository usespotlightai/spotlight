import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessVersion } from '@shared-kernel/domain/value-objects/harness-version.vo';

export class HarnessRelease {
  private constructor(
    readonly harness: HarnessId,
    readonly version: HarnessVersion,
  ) {}

  static of(harness: HarnessId, version: HarnessVersion): HarnessRelease {
    return new HarnessRelease(harness, version);
  }

  static isTerm(selector: string): boolean {
    return /^[^@\s]+@[^@\s]+$/.test(selector);
  }

  get term(): string {
    return `${this.harness.value}@${this.version.value}`;
  }
}
