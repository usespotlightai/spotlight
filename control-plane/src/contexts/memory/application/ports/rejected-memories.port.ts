import type { Rejection } from '@memory/domain/services/rejections-heeded';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const REJECTED_MEMORIES = Symbol('REJECTED_MEMORIES');

export interface RejectedMemory extends Rejection {
  readonly id: string;
  readonly kind: string;
  readonly body: string;
}

export interface RejectedMemoriesPort {
  rejectedOnTeam(
    teamId: TeamId,
    since: Date,
  ): Promise<readonly RejectedMemory[]>;
}
