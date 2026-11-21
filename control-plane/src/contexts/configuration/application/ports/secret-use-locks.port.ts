import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SECRET_USE_LOCKS = Symbol('SECRET_USE_LOCKS');

export interface SecretUseLocksPort {
  lock(teamId: TeamId): Promise<void>;
}
