import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const KNOWN_MEMORIES = Symbol('KNOWN_MEMORIES');

export interface MemoryReach {
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
  readonly repositories: readonly Repository[];
}

export interface KnownMemory {
  readonly id: string;
  readonly kind: string;
  readonly body: string;
}

export interface KnownMemoriesPort {
  standingIn(reach: MemoryReach): Promise<readonly KnownMemory[]>;

  rejectedIn(reach: MemoryReach, since: Date): Promise<readonly KnownMemory[]>;
}
