import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export const TEAM_SECRETS = Symbol('TEAM_SECRETS');

export interface TeamSecretsPort {
  resolveAll(
    teamId: TeamId,
    names: readonly SecretName[],
  ): Promise<Readonly<Record<string, string>>>;

  held(teamId: TeamId): Promise<readonly SecretName[]>;
}
