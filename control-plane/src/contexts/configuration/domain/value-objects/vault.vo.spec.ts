import { SecretValue } from '@configuration/domain/value-objects/secret-value.vo';
import { Vault } from '@configuration/domain/value-objects/vault.vo';
import { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { VaultSecrets } from '@configuration/domain/value-objects/vault-secrets.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const secrets = (held: Record<string, string>) =>
  VaultSecrets.of(
    Object.entries(held).map(([name, value]) => ({
      name: SecretName.of(name),
      value: SecretValue.maybe(value) as SecretValue,
    })),
  );

describe('Vault', () => {
  it('seals what is added over what it held, keeping its key', () => {
    const vault = Vault.opened(VaultKey.of('k'), secrets({ A: '1', B: '2' }));
    const sealed = vault.sealWith(secrets({ B: '3' }));

    expect(sealed.key.value).toBe('k');
    expect(sealed.secrets.valueOf(SecretName.of('B'))?.value).toBe('3');
    expect(sealed.names.map((each) => each.value)).toEqual(['A', 'B']);
  });

  it('says which needed secrets it lacks', () => {
    const vault = Vault.opened(VaultKey.of('k'), secrets({ A: '1' }));

    expect(
      vault
        .missing([SecretName.of('A'), SecretName.of('C')])
        .map((each) => each.value),
    ).toEqual(['C']);
  });

  it('never says what it holds aloud', () => {
    const vault = Vault.opened(VaultKey.of('k'), secrets({ A: 'hunter2' }));

    expect(JSON.stringify({ vault })).not.toContain('hunter2');
  });
});
