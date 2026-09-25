const PROVIDER = /^terraform-provider\/([0-9A-Za-z][0-9A-Za-z.+-]{0,63})$/;

const WEB = 'web';

export type ClientKind = 'terraform-provider' | 'web' | 'unknown';

export class Client {
  private constructor(
    readonly kind: ClientKind,
    readonly version: string | null,
  ) {}

  static named(header: string | undefined): Client {
    const held = header?.trim() ?? '';

    if (held === WEB) {
      return new Client('web', null);
    }

    const provider = PROVIDER.exec(held);

    return provider
      ? new Client('terraform-provider', provider[1] as string)
      : new Client('unknown', null);
  }

  toString(): string {
    return this.version ? `${this.kind}/${this.version}` : this.kind;
  }
}
