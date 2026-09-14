import type { VaultSealingPort } from '@application/ports/vault-sealing.port';
import {
  VaultProblems,
  type VaultRefusal,
} from '@application/rendering/vault-problems';
import { UnopenableVaultError } from '@domain/exceptions/unopenable-vault.error';
import type { VaultKeyRepository } from '@domain/repositories/vault-key.repository';
import type { SealedVault } from '@domain/value-objects/sealed-vault.vo';
import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { VaultKey } from '@domain/value-objects/vault-key.vo';
import type { VaultSecrets } from '@domain/value-objects/vault-secrets.vo';

interface VaultReading {
  readonly names: readonly SecretName[];
  readonly refusal: VaultRefusal | null;
}

type Opened =
  | { readonly secrets: VaultSecrets; readonly key: VaultKey }
  | { readonly refusal: VaultRefusal };

export class TeamVault {
  constructor(
    private readonly keys: VaultKeyRepository,
    private readonly sealing: VaultSealingPort,
  ) {}

  async read(teamId: TeamId, vault: SealedVault): Promise<VaultReading> {
    const opened = await this.opened(teamId, vault);

    return 'refusal' in opened
      ? { names: [], refusal: opened.refusal }
      : { names: opened.secrets.names, refusal: null };
  }

  async sealedWith(
    teamId: TeamId,
    current: SealedVault | null,
    added: VaultSecrets,
  ): Promise<SealedVault> {
    if (!current) {
      return this.sealing.seal(added, await this.keyFor(teamId));
    }

    const opened = await this.opened(teamId, current);

    if ('refusal' in opened) {
      throw new UnopenableVaultError(VaultProblems.reason(opened.refusal));
    }

    return this.sealing.seal(opened.secrets.with(added), opened.key);
  }

  revealKey(teamId: TeamId): Promise<VaultKey> {
    return this.keyFor(teamId);
  }

  private async keyFor(teamId: TeamId): Promise<VaultKey> {
    const lookup = await this.keys.of(teamId);
    const kept =
      lookup.kind === 'none'
        ? await this.keys.keepFirst(teamId, this.sealing.issueKey())
        : lookup;

    if (kept.kind !== 'held') {
      throw new UnopenableVaultError(
        VaultProblems.reason({ because: 'unreadable-key' }),
      );
    }

    return kept.key;
  }

  private async opened(teamId: TeamId, vault: SealedVault): Promise<Opened> {
    const lookup = await this.keys.of(teamId);

    if (lookup.kind === 'none') {
      return { refusal: { because: 'unkeyed' } };
    }
    if (lookup.kind === 'unreadable') {
      return { refusal: { because: 'unreadable-key' } };
    }

    const opening = await this.sealing.open(vault, lookup.key);

    return opening.opened
      ? { secrets: opening.secrets, key: lookup.key }
      : { refusal: { because: opening.because, detail: opening.detail } };
  }
}
