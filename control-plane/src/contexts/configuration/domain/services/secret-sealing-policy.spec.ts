import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import { NotYoursToRevealVaultKeyError } from '@configuration/domain/exceptions/not-yours-to-reveal-vault-key.error';
import { NotYoursToSealSecretsError } from '@configuration/domain/exceptions/not-yours-to-seal-secrets.error';
import {
  mayRevealVaultKey,
  secretsToSeal,
} from '@configuration/domain/services/secret-sealing-policy';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const NEEDED = [SecretName.of('LINEAR_WEBHOOK_SECRET')];

describe('sealing secrets', () => {
  it('takes every needed secret an admin gives', () => {
    const given = secretsToSeal({
      administers: true,
      needed: NEEDED,
      offered: { LINEAR_WEBHOOK_SECRET: 'lin', OTHER: 'x' },
    });

    expect(given.names.map((each) => each.value)).toEqual([
      'LINEAR_WEBHOOK_SECRET',
    ]);
  });

  it('refuses one who does not administer the team', () => {
    expect(() =>
      secretsToSeal({
        administers: false,
        needed: NEEDED,
        offered: { LINEAR_WEBHOOK_SECRET: 'lin' },
      }),
    ).toThrow(NotYoursToSealSecretsError);
  });

  it('refuses where a needed secret is left blank', () => {
    expect(() =>
      secretsToSeal({
        administers: true,
        needed: NEEDED,
        offered: { LINEAR_WEBHOOK_SECRET: '  ' },
      }),
    ).toThrow(MissingSecretsError);
  });

  it('lets only an admin see the vault key', () => {
    expect(() => mayRevealVaultKey({ administers: false })).toThrow(
      NotYoursToRevealVaultKeyError,
    );
    expect(() => mayRevealVaultKey({ administers: true })).not.toThrow();
  });
});
