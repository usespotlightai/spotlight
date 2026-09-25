import { InvalidHarnessVersionError } from '@runners/domain/exceptions/invalid-harness-version.error';

const SHAPE = /^v?([0-9]+(\.[0-9A-Za-z-]+)*)$/;

const MAX_LENGTH = 40;

export class HarnessVersion {
  private constructor(readonly value: string) {}

  static of(raw: string): HarnessVersion {
    const matched = SHAPE.exec(raw.trim());

    if (!matched?.[1] || matched[1].length > MAX_LENGTH) {
      throw new InvalidHarnessVersionError(
        'is a release of the harness CLI, as in 2.1.270',
      );
    }

    return new HarnessVersion(matched[1]);
  }

  static reported(raw: string | undefined): HarnessVersion | null {
    try {
      return raw ? HarnessVersion.of(raw) : null;
    } catch {
      return null;
    }
  }

  equals(other: HarnessVersion): boolean {
    return this.value === other.value;
  }
}
