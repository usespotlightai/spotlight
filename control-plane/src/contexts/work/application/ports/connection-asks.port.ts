import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const CONNECTION_ASKS = Symbol('CONNECTION_ASKS');

export interface ConnectionMade {
  readonly teamId: TeamId;
  readonly integration: string;
  readonly personId: UserId;
}

export interface ConnectionAsksPort {
  answer(made: ConnectionMade): Promise<void>;
}
