import type { VaultKeysPort } from '@configuration/application/ports/vault-keys.port';
import type { VaultSealingPort } from '@configuration/application/ports/vault-sealing.port';
import { VaultProblems } from '@configuration/application/rendering/vault-problems';
import { UnopenableVaultError } from '@configuration/domain/exceptions/unopenable-vault.error';
import type { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import {
  Vault,
  type VaultOpening,
} from '@configuration/domain/value-objects/vault.vo';
import type { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import type { VaultSecrets } from '@configuration/domain/value-objects/vault-secrets.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamVault {
  constructor(
    private readonly keys: VaultKeysPort,
    private readonly sealing: VaultSealingPort,
  ) {}

  async open(teamId: TeamId, sealed: SealedVault): Promise<VaultOpening> {
    const lookup = await this.keys.of(teamId);

    if (lookup.kind === 'none') {
      return { opened: false, refusal: { because: 'unkeyed' } };
    }
    if (lookup.kind === 'unreadable') {
      return { opened: false, refusal: { because: 'unreadable-key' } };
    }

    const opening = await this.sealing.open(sealed, lookup.key);

    return opening.opened
      ? { opened: true, vault: Vault.opened(lookup.key, opening.secrets) }
      : {
          opened: false,
          refusal: { because: opening.because, detail: opening.detail },
        };
  }

  async sealedWith(
    teamId: TeamId,
    current: SealedVault | null,
    added: VaultSecrets,
  ): Promise<SealedVault> {
    const vault = current
      ? await this.opened(teamId, current)
      : Vault.empty(await this.keyFor(teamId));
    const sealed = vault.sealWith(added);

    return this.sealing.seal(sealed.secrets, sealed.key);
  }

  revealKey(teamId: TeamId): Promise<VaultKey> {
    return this.keyFor(teamId);
  }

  private async opened(teamId: TeamId, sealed: SealedVault): Promise<Vault> {
    const opening = await this.open(teamId, sealed);

    if (!opening.opened) {
      throw new UnopenableVaultError(VaultProblems.reason(opening.refusal));
    }

    return opening.vault;
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
}
