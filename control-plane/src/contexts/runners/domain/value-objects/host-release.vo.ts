import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';

const LONGEST = 64;

export class HostRelease {
  static readonly MINIMUM = Release.of('v0.1.0-rc.1');

  private constructor(
    readonly value: string,
    private readonly published: Release | null,
  ) {}

  static of(raw: string): HostRelease {
    const trimmed = raw.trim();

    if (!trimmed || trimmed.length > LONGEST) {
      throw new InvalidHostReportError(
        'release',
        `must be 1 to ${LONGEST} characters`,
      );
    }

    return new HostRelease(trimmed, Release.published(trimmed));
  }

  get isOutdated(): boolean {
    return this.published?.isOlderThan(HostRelease.MINIMUM) ?? false;
  }

  equals(other: HostRelease): boolean {
    return this.value === other.value;
  }
}
