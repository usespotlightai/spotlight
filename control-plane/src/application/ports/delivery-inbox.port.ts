import type { WebhookHeaders } from '@application/ports/webhook-source.port';

export const DELIVERY_INBOX = Symbol('DELIVERY_INBOX');

export interface StoredDelivery {
  readonly source: string;
  readonly id: string;
  readonly headers: WebhookHeaders;
  readonly body: unknown;
  readonly attempts: number;
}

/**
 * What hosts have told us, kept as it arrived and worked afterwards. A host
 * sends the same word more than once — on retry, and whenever someone asks it
 * to — so taking it in is what makes it ours, and only once.
 */
export interface DeliveryInboxPort {
  /**
   * Takes this delivery as ours to work, if nobody has already. True the
   * first time it is offered and false ever after: it writes as it answers.
   */
  accept(delivered: StoredDelivery): Promise<boolean>;

  /**
   * The oldest delivery nobody else is working, held for as long as the
   * caller's transaction runs. Null where there is nothing waiting.
   */
  nextPending(): Promise<StoredDelivery | null>;

  worked(source: string, id: string): Promise<void>;

  /** Left as it is, with why, for whoever comes to look. */
  failed(source: string, id: string, because: string): Promise<void>;
}
