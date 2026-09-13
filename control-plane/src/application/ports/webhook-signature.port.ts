export interface WebhookSignaturePort {
  signs(payload: Uint8Array, signature: string | undefined): boolean;
}
