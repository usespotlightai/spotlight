import { InvalidVaultKeyError } from '@configuration/domain/exceptions/invalid-vault-key.error';
import { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { describe, expect, it } from 'vitest';

describe('VaultKey', () => {
  it('holds the key it was given', () => {
    expect(VaultKey.of('vault-key').value).toBe('vault-key');
  });

  it('is the same key as another spelled the same', () => {
    expect(VaultKey.of('vault-key').equals(VaultKey.of('vault-key'))).toBe(
      true,
    );
    expect(VaultKey.of('vault-key').equals(VaultKey.of('other-key'))).toBe(
      false,
    );
  });

  it('refuses an empty key', () => {
    expect(() => VaultKey.of('')).toThrow(InvalidVaultKeyError);
  });

  it('never says the key where it is printed or serialised', () => {
    const key = VaultKey.of('vault-key');

    expect(String(key)).toBe('[vault key]');
    expect(`${key}`).not.toContain('vault-key');
    expect(JSON.stringify({ key })).toBe('{"key":"[vault key]"}');
  });
});
