import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';

const MOST = 64;

export class HostSession {
  private readonly kind = 'host-session';

  private constructor(readonly value: string) {}

  static of(raw: string): HostSession {
    const value = raw.trim();

    if (!value || value.length > MOST) {
      throw new InvalidHostReportError(
        'session',
        `must be 1 to ${MOST} characters`,
      );
    }

    return new HostSession(value);
  }

  equals(other: HostSession): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
