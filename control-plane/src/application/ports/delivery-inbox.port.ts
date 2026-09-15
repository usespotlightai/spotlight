import type { WebhookHeaders } from '@application/ports/webhook-source.port';

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

  // Held for the caller's transaction, so concurrent workers never take the same delivery.
  nextPending(): Promise<StoredDelivery | null>;

  worked(delivered: StoredDelivery): Promise<void>;

  failed(delivered: StoredDelivery, because: string): Promise<void>;
}
