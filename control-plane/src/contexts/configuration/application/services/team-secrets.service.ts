import { sealedVaultIn } from '@configuration/application/contracts/configuration-layout.contract';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { TeamSecretsPort } from '@configuration/application/ports/team-secrets.port';
import { VaultProblems } from '@configuration/application/rendering/vault-problems';
import type { TeamVault } from '@configuration/application/services/team-vault.service';
import { UnopenableVaultError } from '@configuration/domain/exceptions/unopenable-vault.error';
import type { VaultOpening } from '@configuration/domain/value-objects/vault.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamSecrets implements TeamSecretsPort {
  constructor(
    private readonly configurations: AppliedConfigurationPort,
    private readonly vault: TeamVault,
  ) {}

  async resolveAll(
    teamId: TeamId,
    names: readonly SecretName[],
  ): Promise<Readonly<Record<string, string>>> {
    const opening = await this.opening(teamId);

    if (!opening) {
      return {};
    }

    if (!opening.opened) {
      throw new UnopenableVaultError(VaultProblems.reason(opening.refusal));
    }

    return Object.fromEntries(
      names.flatMap((name) => {
        const value = opening.vault.secrets.valueOf(name);
        return value ? [[name.value, value.value]] : [];
      }),
    );
  }

  async held(teamId: TeamId): Promise<readonly SecretName[]> {
    const opening = await this.opening(teamId);

    return opening?.opened ? opening.vault.names : [];
  }

  private async opening(teamId: TeamId): Promise<VaultOpening | null> {
    const applied = await this.configurations.of(teamId);
    const sealed = applied ? sealedVaultIn(applied.files) : null;

    return sealed ? this.vault.open(teamId, sealed) : null;
  }
}
