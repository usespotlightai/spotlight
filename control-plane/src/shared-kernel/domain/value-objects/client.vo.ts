const VERSIONED =
  /^(terraform-provider|cli)\/([0-9A-Za-z][0-9A-Za-z.+-]{0,63})$/;

const WEB = 'web';

export type ClientKind = 'terraform-provider' | 'cli' | 'web' | 'unknown';

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

    const versioned = VERSIONED.exec(held);

    return versioned
      ? new Client(versioned[1] as ClientKind, versioned[2] as string)
      : new Client('unknown', null);
  }

  toString(): string {
    return this.version ? `${this.kind}/${this.version}` : this.kind;
  }
}
