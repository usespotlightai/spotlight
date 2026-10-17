import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SEPARATOR = '/';

const refused = (): never => {
  throw new InvalidIdentifierError(
    'hook address',
    'is the team key and the hook key, as in core/migrations-need-a-dba',
  );
};

export class HookAddress {
  private readonly kind = 'hook-address';

  private constructor(
    readonly teamKey: string,
    readonly key: HookKey,
  ) {}

  static of(teamKey: string, key: HookKey): HookAddress {
    return isSlug(teamKey) ? new HookAddress(teamKey, key) : refused();
  }

  static parse(raw: string): HookAddress {
    const [teamKey, key, ...rest] = raw.trim().split(SEPARATOR);

    return teamKey && key && rest.length === 0
      ? HookAddress.of(teamKey, HookKey.of(key))
      : refused();
  }

  equals(other: HookAddress): boolean {
    return (
      this.kind === other.kind &&
      this.teamKey === other.teamKey &&
      this.key.equals(other.key)
    );
  }

  toString(): string {
    return [this.teamKey, this.key.value].join(SEPARATOR);
  }
}
