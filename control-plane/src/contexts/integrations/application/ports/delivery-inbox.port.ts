import type { WebhookHeaders } from '@integrations/application/ports/webhook-source.port';

export const DELIVERY_INBOX = Symbol('DELIVERY_INBOX');

export interface StoredDelivery {
  readonly source: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly teamKey: string;
  readonly id: string;
  readonly headers: WebhookHeaders;
  readonly body: unknown;
  readonly attempts: number;
}

export interface DeliveryInboxPort {
  accept(delivered: StoredDelivery): Promise<boolean>;

  claimNext(now: Date): Promise<StoredDelivery | null>;

  worked(delivered: StoredDelivery, at: Date): Promise<void>;

  retryAt(delivered: StoredDelivery, because: string, at: Date): Promise<void>;

  failed(delivered: StoredDelivery, because: string, at: Date): Promise<void>;
}
