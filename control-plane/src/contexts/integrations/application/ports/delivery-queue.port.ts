import type { WebhookHeaders } from '@integrations/application/ports/webhook-provider.port';

export const DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE');

export interface StoredDelivery {
  readonly integration: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly teamKey: string;
  readonly id: string;
  readonly headers: WebhookHeaders;
  readonly body: unknown;
  readonly attempts: number;
}

export interface DeliveryQueuePort {
  accept(delivered: StoredDelivery): Promise<boolean>;

  claimNext(now: Date): Promise<StoredDelivery | null>;

  markDone(delivered: StoredDelivery, at: Date): Promise<void>;

  retryAt(delivered: StoredDelivery, because: string, at: Date): Promise<void>;

  failed(delivered: StoredDelivery, because: string, at: Date): Promise<void>;
}
