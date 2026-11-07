import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';

const HOST = new RegExp(`^(?=.{1,253}$)${LABEL}(?:\\.${LABEL})+$`);

export class BoundHost {
  private readonly kind = 'bound-host';

  private constructor(readonly value: string) {}

  static of(raw: string): BoundHost {
    const host = raw.trim().toLowerCase();

    if (!HOST.test(host)) {
      throw new InvalidSecretError(
        'host',
        'must be one host with no scheme, port or path, as in api.linear.app',
      );
    }

    return new BoundHost(host);
  }

  serves(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === this.value;
  }

  equals(other: BoundHost): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
