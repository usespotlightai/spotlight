import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SECRET_NAMES = Symbol('SECRET_NAMES');

export interface SecretNamesPort {
  ofTeam(teamId: TeamId): Promise<readonly SecretName[]>;
}
