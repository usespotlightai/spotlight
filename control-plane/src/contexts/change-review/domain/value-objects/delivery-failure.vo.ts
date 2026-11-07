import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const DELIVERY_FAILURE_CODES = [
  'task-deleted',
  'not-connected',
  'subject-deleted',
  'parent-deleted',
  'parent-not-on-github',
  'parent-never-on-github',
  'never-on-github',
  'not-recorded',
  'github-error',
] as const;

export type DeliveryFailureCode = (typeof DELIVERY_FAILURE_CODES)[number];

const MAX_DETAIL = 1_000;

export class DeliveryFailure {
  private constructor(
    readonly code: DeliveryFailureCode,
    readonly detail: string | null,
  ) {}

  static of(
    code: DeliveryFailureCode,
    detail: string | null = null,
  ): DeliveryFailure {
    return new DeliveryFailure(
      code,
      detail?.trim().slice(0, MAX_DETAIL) || null,
    );
  }

  static rehydrate(code: string, detail: string | null): DeliveryFailure {
    if (!(DELIVERY_FAILURE_CODES as readonly string[]).includes(code)) {
      throw new InconsistentStateError(
        'review delivery',
        `failed for ${code}, which is not a known reason`,
      );
    }

    return DeliveryFailure.of(code as DeliveryFailureCode, detail);
  }

  equals(other: DeliveryFailure): boolean {
    return this.code === other.code && this.detail === other.detail;
  }
}
