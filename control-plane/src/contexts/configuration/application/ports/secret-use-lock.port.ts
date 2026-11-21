import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SECRET_USE_LOCK = Symbol('SECRET_USE_LOCK');

export interface SecretUseLockPort {
  lockUsesBy(teamId: TeamId): Promise<void>;
}
