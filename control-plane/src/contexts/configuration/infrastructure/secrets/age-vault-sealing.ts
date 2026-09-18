import { createHash } from 'node:crypto';
import type {
  VaultOpening,
  VaultSealingPort,
} from '@configuration/application/ports/vault-sealing.port';
import { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import { SecretValue } from '@configuration/domain/value-objects/secret-value.vo';
import { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { VaultSecrets } from '@configuration/domain/value-objects/vault-secrets.vo';
import {
  NOT_SECRETS,
  newVaultKey,
  openVault,
  sealVault,
  VaultError,
  WORK_FACTOR,
} from '@configuration/infrastructure/secrets/age-vault';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

const MOST_KEPT = 500;

const hashed = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

const secretsFrom = (read: Readonly<Record<string, string>>): VaultSecrets =>
  VaultSecrets.of(
    Object.entries(read).flatMap(([name, text]) => {
      const value = SecretValue.maybe(text);
      return value ? [{ name: SecretName.of(name), value }] : [];
    }),
  );

export class AgeVaultSealing implements VaultSealingPort {
  private readonly opened = new Map<string, VaultOpening>();

  constructor(private readonly workFactor: number = WORK_FACTOR) {}

  issueKey(): VaultKey {
    return VaultKey.of(newVaultKey());
  }

  async open(vault: SealedVault, key: VaultKey): Promise<VaultOpening> {
    const kept = `${hashed(key.value)}:${hashed(vault.text)}`;
    const cached = this.opened.get(kept);

    if (cached) {
      return cached;
    }

    const opening = await this.opening(vault, key);

    if (this.opened.size >= MOST_KEPT) {
      this.opened.clear();
    }
    this.opened.set(kept, opening);

    return opening;
  }

  async seal(secrets: VaultSecrets, key: VaultKey): Promise<SealedVault> {
    return SealedVault.of(
      await sealVault(
        Object.fromEntries(
          secrets.entries.map((each) => [each.name.value, each.value.value]),
        ),
        key.value,
        this.workFactor,
      ),
    );
  }

  private async opening(
    vault: SealedVault,
    key: VaultKey,
  ): Promise<VaultOpening> {
    try {
      return {
        opened: true,
        secrets: secretsFrom(await openVault(vault.text, key.value)),
      };
    } catch (error) {
      if (error instanceof VaultError) {
        return error.reason === 'not-for-this-key'
          ? {
              opened: false,
              because: 'not-for-this-key',
              detail: error.message,
            }
          : { opened: false, because: 'unreadable', detail: error.message };
      }
      if (error instanceof InvalidIdentifierError) {
        return { opened: false, because: 'unreadable', detail: NOT_SECRETS };
      }
      throw error;
    }
  }
}
