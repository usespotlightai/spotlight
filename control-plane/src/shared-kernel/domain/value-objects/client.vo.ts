import { nonEmpty } from '@shared-kernel/domain/non-empty';
const VERSIONED =
  /^(terraform-provider|cli)\/([0-9A-Za-z][0-9A-Za-z.+-]{0,63})$/;

const WEB = 'web';

export type ClientKind = 'terraform-provider' | 'cli' | 'web' | 'unknown';

const isVersionedKind = (
  kind: string | undefined,
): kind is 'terraform-provider' | 'cli' =>
  kind === 'terraform-provider' || kind === 'cli';

export class Client {
  private constructor(
    readonly kind: ClientKind,
    readonly version: string | null,
  ) {}

  static named(header: string | undefined): Client {
    const value = header?.trim() ?? '';

    if (value === WEB) {
      return new Client('web', null);
    }

    const [, kind, version] = VERSIONED.exec(value) ?? [];

    return isVersionedKind(kind)
      ? new Client(kind, version)
      : new Client('unknown', null);
  }

  toString(): string {
    return nonEmpty(this.version) ? `${this.kind}/${this.version}` : this.kind;
  }
}
