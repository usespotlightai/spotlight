import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const PROVISION_FAILURES = [
  'unreachable',
  'refused',
  'not-allowed',
  'unusable',
  'lapsed',
  'harness-missing',
] as const;

export type ProvisionFailureKind = (typeof PROVISION_FAILURES)[number];

const MOST_DETAIL = 1_000;

export class ProvisionFailure {
  private constructor(
    readonly kind: ProvisionFailureKind,
    readonly detail: string,
  ) {}

  static of(kind: string, detail: string): ProvisionFailure {
    const known = PROVISION_FAILURES.find((each) => each === kind);

    if (!known) {
      throw new InconsistentStateError(
        'provision failure',
        `is of an unknown kind (${kind})`,
      );
    }

    return new ProvisionFailure(known, detail.trim().slice(0, MOST_DETAIL));
  }

  static lapsed(until: Date): ProvisionFailure {
    return ProvisionFailure.of(
      'lapsed',
      `the pool accepted the work, but no runner claimed it by ${until.toISOString()}`,
    );
  }

  static harnessMissing(harness: string): ProvisionFailure {
    return ProvisionFailure.of(
      'harness-missing',
      `the runner the pool started has no ${harness} installed`,
    );
  }

  get saying(): string {
    return `${this.kind}: ${this.detail}`;
  }

  equals(other: ProvisionFailure): boolean {
    return this.kind === other.kind && this.detail === other.detail;
  }
}
