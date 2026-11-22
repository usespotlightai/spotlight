import {
  MemoryUpkeepSchedule,
  UPKEEP_AFTER_NEW_MEMORIES,
  UPKEEP_EVERY_MS,
} from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { ConsolidationRound } from '@memory/domain/value-objects/consolidation-round.vo';
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

describe('a sweep that consolidates in an assist session', () => {
  const DUE = new Date(NOW.getTime() + UPKEEP_EVERY_MS);
  const leased = () => first().leaseJob(DUE);

  it('consolidates in the round of its sweep and its job’s attempt', () => {
    const round = leased().consolidationRound();

    expect(round.teamId).toEqual(TeamId.of('team_1'));
    expect(round.dueAt).toEqual(DUE);
    expect(round.attempt).toBe(1);
  });

  it('keeps its round while it waits, and takes a new one once it is retried', () => {
    const round = leased().consolidationRound();
    const waited = leased().waitJob(DUE);
    const later = new Date(DUE.getTime() + 60_000);

    expect(waited.leaseJob(later).consolidationRound().equals(round)).toBe(
      true,
    );
    expect(
      leased()
        .scheduleRetry(DUE)
        .leaseJob(new Date(DUE.getTime() + 3_600_000))
        .consolidationRound()
        .equals(round),
    ).toBe(false);
  });

  it('wakes its waiting job once the session of its sweep settles', () => {
    const waiting = leased().waitJob(DUE);
    const soon = new Date(DUE.getTime() + 5_000);

    expect(waiting.isDue(soon)).toBe(false);
    expect(waiting.wake(leased().consolidationRound(), soon).isDue(soon)).toBe(
      true,
    );
  });

  it('stays asleep for a session of another sweep', () => {
    const waiting = leased().waitJob(DUE);
    const earlier = ConsolidationRound.of({
      teamId: TeamId.of('team_1'),
      dueAt: NOW,
      attempt: 1,
    });

    expect(waiting.wake(earlier, DUE)).toBe(waiting);
  });
});
