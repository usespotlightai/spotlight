import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

const BACKING_OFF = Retry.backoff({
  most: 5,
  firstMs: 5_000,
  longestMs: 120_000,
});

export const PROVISION_FAILURES = {
  unreachable: BACKING_OFF,
  refused: BACKING_OFF,
  lapsed: BACKING_OFF,
  'not-allowed': Retry.never(),
  unusable: Retry.never(),
  'harness-missing': Retry.never(),
} as const satisfies Record<string, Retry>;

export type ProvisionFailureKind = keyof typeof PROVISION_FAILURES;

const isKind = (kind: string): kind is ProvisionFailureKind =>
  Object.keys(PROVISION_FAILURES).includes(kind);

const MOST_DETAIL = 1_000;

export class ProvisionFailure {
  private constructor(
    readonly kind: ProvisionFailureKind,
    readonly detail: string,
  ) {}

  static of(kind: string, detail: string): ProvisionFailure {
    if (!isKind(kind)) {
      throw new InconsistentStateError(
        'provision failure',
        `is of an unknown kind (${kind})`,
      );
    }

    return new ProvisionFailure(kind, detail.trim().slice(0, MOST_DETAIL));
  }

  static lapsed(until: Date): ProvisionFailure {
    return ProvisionFailure.of(
      'lapsed',
      `The pool accepted the work. No runner claimed it by ${until.toISOString()}.`,
    );
  }

  static harnessMissing(harness: string): ProvisionFailure {
    return ProvisionFailure.of(
      'harness-missing',
      `The runner that the pool started doesn't have ${harness} installed.`,
    );
  }

  get retry(): Retry {
    return PROVISION_FAILURES[this.kind];
  }

  get saying(): string {
    return `${this.kind}: ${this.detail}`;
  }

  equals(other: ProvisionFailure): boolean {
    return this.kind === other.kind && this.detail === other.detail;
  }
}
