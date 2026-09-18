import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import { NotYoursToRevealVaultKeyError } from '@configuration/domain/exceptions/not-yours-to-reveal-vault-key.error';
import { NotYoursToSealSecretsError } from '@configuration/domain/exceptions/not-yours-to-seal-secrets.error';
import { SecretValue } from '@configuration/domain/value-objects/secret-value.vo';
import {
  type VaultSecret,
  VaultSecrets,
} from '@configuration/domain/value-objects/vault-secrets.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export const secretsToSeal = (input: {
  administers: boolean;
  needed: readonly SecretName[];
  offered: Readonly<Record<string, string>>;
}): VaultSecrets => {
  if (!input.administers) {
    throw new NotYoursToSealSecretsError();
  }

  const given = VaultSecrets.of(
    input.needed.flatMap((name): VaultSecret[] => {
      const value = SecretValue.maybe(input.offered[name.value] ?? '');
      return value ? [{ name, value }] : [];
    }),
  );
  const missing = given.missing(input.needed);

  if (missing.length > 0) {
    throw new MissingSecretsError(missing);
  }

  return given;
};

export const mayRevealVaultKey = (input: { administers: boolean }): void => {
  if (!input.administers) {
    throw new NotYoursToRevealVaultKeyError();
  }
};
