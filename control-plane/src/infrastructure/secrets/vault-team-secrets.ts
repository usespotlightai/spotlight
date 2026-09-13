import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { VaultSealingPort } from '@application/ports/vault-sealing.port';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { VaultKeyRepository } from '@domain/repositories/vault-key.repository';
import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { VaultSecrets } from '@domain/value-objects/vault-secrets.vo';

export class VaultTeamSecrets implements TeamSecretsPort {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly keys: VaultKeyRepository,
    private readonly sealing: VaultSealingPort,
  ) {}

  async resolveAll(
    teamId: TeamId,
    names: readonly SecretName[],
  ): Promise<Readonly<Record<string, string>>> {
    const secrets = await this.applied(teamId);

    return Object.fromEntries(
      names.flatMap((name) => {
        const value = secrets.valueOf(name);
        return value ? [[name.value, value.value]] : [];
      }),
    );
  }

  async held(teamId: TeamId): Promise<readonly SecretName[]> {
    return (await this.applied(teamId)).names;
  }

  private async applied(teamId: TeamId): Promise<VaultSecrets> {
    const vault = (await this.configurations.findFor(teamId))?.vault;
    const lookup = vault ? await this.keys.of(teamId) : null;
    const opening =
      vault && lookup?.kind === 'held'
        ? await this.sealing.open(vault, lookup.key)
        : null;

    return opening?.opened ? opening.secrets : VaultSecrets.none();
  }
}
