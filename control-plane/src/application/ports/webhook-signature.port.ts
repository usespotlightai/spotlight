/**
 * How one source tells its own host's deliveries from anyone else's. Anyone
 * can post to a webhook, so nothing arriving there is acted on until this
 * says the host really sent it.
 *
 * Every host signs its own way, so this is a source's to hold rather than
 * the deployment's: nothing here is shared between two of them.
 */
export interface WebhookSignaturePort {
  signs(payload: Uint8Array, signature: string | undefined): boolean;
}
