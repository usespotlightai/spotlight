import { InvalidVaultKeyError } from '@configuration/domain/exceptions/invalid-vault-key.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class VaultKey implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(readonly value: string) {}

  static of(raw: string): VaultKey {
    if (raw.length === 0) {
      throw new InvalidVaultKeyError();
    }

    return new VaultKey(raw);
  }

  equals(other: VaultKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return '[vault key]';
  }

  toJSON(): string {
    return '[vault key]';
  }
}
