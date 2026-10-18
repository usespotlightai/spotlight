import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';

const MOST = 64;

export class BootId {
  private readonly kind = 'boot-id';

  private constructor(readonly value: string) {}

  static of(raw: string): BootId {
    const value = raw.trim();

    if (!value || value.length > MOST) {
      throw new InvalidHostReportError(
        'bootId',
        `must be 1 to ${MOST} characters`,
      );
    }

    return new BootId(value);
  }

  equals(other: BootId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
