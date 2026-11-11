import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const DELIVERY_FAILURE_CODES = [
  'task-deleted',
  'not-connected',
  'parent-deleted',
  'parent-not-on-github',
  'parent-never-on-github',
  'never-on-github',
  'pull-request-ambiguous',
  'not-recorded',
  'github-unreachable',
  'github-rejected',
  'unexpected',
] as const;

export type DeliveryFailureCode = (typeof DELIVERY_FAILURE_CODES)[number];

export type DeliveryRecovery = 'permanent' | 'transient' | 'waits-for-thread';

const RECOVERY: Readonly<Record<DeliveryFailureCode, DeliveryRecovery>> = {
  'task-deleted': 'permanent',
  'not-connected': 'permanent',
  'parent-deleted': 'permanent',
  'parent-not-on-github': 'waits-for-thread',
  'parent-never-on-github': 'permanent',
  'never-on-github': 'permanent',
  'pull-request-ambiguous': 'permanent',
  'not-recorded': 'permanent',
  'github-unreachable': 'transient',
  'github-rejected': 'permanent',
  unexpected: 'permanent',
};

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

  get recovery(): DeliveryRecovery {
    return RECOVERY[this.code];
  }

  equals(other: DeliveryFailure): boolean {
    return this.code === other.code && this.detail === other.detail;
  }
}
