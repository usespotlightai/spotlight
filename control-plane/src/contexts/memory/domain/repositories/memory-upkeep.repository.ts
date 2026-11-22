import type { MemoryUpkeepSchedule } from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import type { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import type { UpkeepHistory } from '@memory/domain/services/held-back';
import type { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const MEMORY_UPKEEPS = Symbol('MEMORY_UPKEEPS');

export const MEMORY_UPKEEP_SCHEDULES = Symbol('MEMORY_UPKEEP_SCHEDULES');

export interface MemoryUpkeepRepository {
  add(upkeep: MemoryUpkeep): Promise<void>;

  save(upkeep: MemoryUpkeep): Promise<void>;

  find(id: MemoryUpkeepId): Promise<MemoryUpkeep | null>;

  ofTeam(teamId: TeamId): Promise<readonly MemoryUpkeep[]>;

  remove(upkeep: MemoryUpkeep): Promise<void>;

  historySince(teamId: TeamId, since: Date): Promise<readonly UpkeepHistory[]>;
}

export interface MemoryUpkeepScheduleRepository {
  ofTeam(teamId: TeamId): Promise<MemoryUpkeepSchedule | null>;

  ofTeamLocked(teamId: TeamId): Promise<MemoryUpkeepSchedule | null>;

  add(schedule: MemoryUpkeepSchedule): Promise<void>;

  save(schedule: MemoryUpkeepSchedule): Promise<void>;

  remove(schedule: MemoryUpkeepSchedule): Promise<void>;

  nextDue(now: Date): Promise<MemoryUpkeepSchedule | null>;
}
