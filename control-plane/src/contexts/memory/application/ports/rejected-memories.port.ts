import type { Rejection } from '@memory/domain/services/recent-rejections';
import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const REJECTED_MEMORIES = Symbol('REJECTED_MEMORIES');

export interface RejectedMemory extends Rejection {
  readonly id: MemoryId;
  readonly kind: MemoryKind;
  readonly body: MemoryBody;
}

export interface RejectedMemoriesPort {
  rejectedOnTeam(
    teamId: TeamId,
    since: Date,
  ): Promise<readonly RejectedMemory[]>;
}
