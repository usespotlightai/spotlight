export const WEBHOOK_SIGNATURE = Symbol('WEBHOOK_SIGNATURE');

/**
 * Anyone can post to a webhook, so nothing arriving there is acted on until
 * the signature says it came from GitHub.
 */
export interface WebhookSignaturePort {
  signs(payload: Uint8Array, signature: string | undefined): boolean;
}
