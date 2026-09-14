import { InvalidVaultKeyError } from '@domain/exceptions/invalid-vault-key.error';

export class VaultKey {
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
