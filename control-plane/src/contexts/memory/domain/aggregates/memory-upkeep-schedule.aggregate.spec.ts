import {
  MemoryUpkeepSchedule,
  UPKEEP_AFTER_NEW_MEMORIES,
  UPKEEP_EVERY_MS,
} from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');

const first = () =>
  MemoryUpkeepSchedule.first({
    teamId: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    now: NOW,
  });

const addedTimes = (
  schedule: MemoryUpkeepSchedule,
  times: number,
): MemoryUpkeepSchedule =>
  Array.from({ length: times }).reduce<MemoryUpkeepSchedule>(
    (each) => each.memoryAdded(NOW),
    schedule,
  );

describe('a memory upkeep schedule', () => {
  it('is due a week after the team’s first memory', () => {
    expect(first().dueAt.getTime()).toBe(NOW.getTime() + UPKEEP_EVERY_MS);
    expect(first().isDue(NOW)).toBe(false);
  });

  it('is due at once after enough new memories', () => {
    const counted = addedTimes(first(), UPKEEP_AFTER_NEW_MEMORIES);

    expect(counted.isDue(NOW)).toBe(true);
  });

  it('counts no new memory while a sweep is due, so a running sweep keeps its version', () => {
    const due = addedTimes(first(), UPKEEP_AFTER_NEW_MEMORIES);

    expect(due.memoryAdded(NOW)).toBe(due);
  });

  it('has a pending job only while a sweep is leased, and none once dead-lettered', () => {
    const due = new Date(NOW.getTime() + UPKEEP_EVERY_MS);
    const leased = first().leaseJob(due);

    expect(first().hasPendingJob).toBe(false);
    expect(leased.hasPendingJob).toBe(true);
    expect(leased.deadLetter(due).hasPendingJob).toBe(false);
  });
});
