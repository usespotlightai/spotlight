export const WEBHOOK_SIGNATURE = Symbol('WEBHOOK_SIGNATURE');

export interface WebhookSignaturePort {
  signs(payload: Uint8Array, signature: string | undefined): boolean;
}
