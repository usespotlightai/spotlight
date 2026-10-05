import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretCarrier } from '@secrets/domain/value-objects/secret-carrier.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import type { SecretCarrierKind } from '@shared-kernel/domain/value-objects/secret-carriers';

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';

const HOST = new RegExp(`^(?=.{1,253}$)${LABEL}(?:\\.${LABEL})+$`);

const PREFIX = /^[\x20-\x7e]{0,64}$/;

export interface WornSecret {
  readonly carrier: SecretCarrierKind;
  readonly name: string;
  readonly value: string;
  readonly bare: string;
}

export class SecretBinding {
  private constructor(
    readonly host: string,
    readonly carrier: SecretCarrier,
    readonly prefix: string,
  ) {}

  static of(input: {
    host: string;
    carrier?: string | null;
    name?: string | null;
    prefix?: string | null;
  }): SecretBinding {
    const host = input.host.trim().toLowerCase();
    const prefix = input.prefix ?? '';

    if (!HOST.test(host)) {
      throw new InvalidSecretError(
        'host',
        'is the one host the secret may be sent to, as in api.linear.app, with no scheme, port or path',
      );
    }

    const carrier = SecretCarrier.of(input);

    if (!PREFIX.test(prefix)) {
      throw new InvalidSecretError(
        'prefix',
        'is up to 64 printable characters written before the value, as in "Bearer "',
      );
    }

    return new SecretBinding(host, carrier, prefix);
  }

  toward(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === this.host;
  }

  wear(value: SecretValue): WornSecret {
    return {
      carrier: this.carrier.kind,
      name: this.carrier.name,
      value: `${this.prefix}${value.revealed()}`,
      bare: value.revealed(),
    };
  }

  equals(other: SecretBinding): boolean {
    return (
      this.host === other.host &&
      this.carrier.equals(other.carrier) &&
      this.prefix === other.prefix
    );
  }
}
