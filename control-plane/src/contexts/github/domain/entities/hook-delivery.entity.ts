import {
  exhausted,
  HOOK_DELIVERY_LOOKBACK_MS,
  type HookDeliveryHistory,
  type HookDeliveryOutcome,
  redeliveryDue,
} from '@github/domain/services/hook-redelivery-policy';

export interface FailedHookAttempt {
  readonly id: number;
  readonly guid: string;
  readonly deliveredAt: Date;
  readonly outcome: Exclude<HookDeliveryOutcome, 'delivered'>;
}

export class HookDelivery implements HookDeliveryHistory {
  private constructor(
    readonly guid: string,
    readonly firstAt: Date,
    readonly lastAt: Date,
    readonly lastOutcome: HookDeliveryOutcome,
    readonly attempts: number,
    readonly requests: number,
    readonly requestedAt: Date | null,
    readonly latestAttemptId: number,
    readonly gaveUp: boolean,
  ) {}

  static failed(attempt: FailedHookAttempt): HookDelivery {
    return new HookDelivery(
      attempt.guid,
      attempt.deliveredAt,
      attempt.deliveredAt,
      attempt.outcome,
      1,
      0,
      null,
      attempt.id,
      false,
    ).givingUpWhenExhausted();
  }

  static dueOldestFirst(
    deliveries: Iterable<HookDelivery>,
    now: Date,
  ): readonly HookDelivery[] {
    return [...deliveries]
      .filter((each) => each.isDue(now))
      .sort((one, other) => one.firstAt.getTime() - other.firstAt.getTime());
  }

  get exhausted(): boolean {
    return exhausted(this);
  }

  failedAgain(attempt: FailedHookAttempt): HookDelivery {
    return new HookDelivery(
      this.guid,
      this.firstAt,
      attempt.deliveredAt,
      attempt.outcome,
      this.attempts + 1,
      this.requests,
      this.requestedAt,
      attempt.id,
      this.gaveUp,
    ).givingUpWhenExhausted();
  }

  requested(at: Date): HookDelivery {
    return new HookDelivery(
      this.guid,
      this.firstAt,
      this.lastAt,
      this.lastOutcome,
      this.attempts,
      this.requests + 1,
      at,
      this.latestAttemptId,
      this.gaveUp,
    );
  }

  isDue(now: Date): boolean {
    return redeliveryDue(this, now);
  }

  isGone(now: Date): boolean {
    return this.firstAt.getTime() < now.getTime() - HOOK_DELIVERY_LOOKBACK_MS;
  }

  private givingUpWhenExhausted(): HookDelivery {
    return this.gaveUp || !this.exhausted
      ? this
      : new HookDelivery(
          this.guid,
          this.firstAt,
          this.lastAt,
          this.lastOutcome,
          this.attempts,
          this.requests,
          this.requestedAt,
          this.latestAttemptId,
          true,
        );
  }
}
