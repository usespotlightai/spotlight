/**
 * An outbound call to a host the deployment did not allow. A config author can
 * template any URL; this is the boundary that keeps a templated one, with real
 * secrets in its headers, from reaching somewhere it should not.
 */
export class EgressRefusedError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(host: string, reason: string) {
    super(`${host}: ${reason}`);
    this.name = 'EgressRefusedError';
  }
}
