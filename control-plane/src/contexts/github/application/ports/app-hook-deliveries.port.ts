export const APP_HOOK_DELIVERIES = Symbol('APP_HOOK_DELIVERIES');

export interface HookDeliveryAttempt {
  // A GitHub id is a 64-bit integer, past the safe range of a JS number.
  readonly id: string;
  readonly guid: string;
  readonly deliveredAt: Date;
  readonly statusCode: number | null;
}

export interface HookDeliveryPage {
  readonly attempts: readonly HookDeliveryAttempt[];
  readonly next: string | null;
}

export interface AppHookDeliveriesPort {
  page(cursor: string | null): Promise<HookDeliveryPage>;

  redeliver(attemptId: string): Promise<void>;
}
