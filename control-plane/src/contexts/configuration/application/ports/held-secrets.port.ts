import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HELD_SECRETS = Symbol('HELD_SECRETS');

export interface HeldSecretsPort {
  held(teamId: TeamId): Promise<readonly SecretName[]>;
}
