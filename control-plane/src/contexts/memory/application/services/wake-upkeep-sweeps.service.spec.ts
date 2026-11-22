import type { MemoryConsolidatorPort } from '@memory/application/ports/memory-consolidator.port';
import { WakeUpkeepSweeps } from '@memory/application/services/wake-upkeep-sweeps.service';
import {
  MemoryUpkeepSchedule,
  UPKEEP_EVERY_MS,
} from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { MemoryUpkeepScheduleVersionConflictError } from '@memory/domain/exceptions/memory-upkeep-schedule-version-conflict.error';
import type { MemoryUpkeepScheduleRepository } from '@memory/domain/repositories/memory-upkeep.repository';
import type { ConsolidationRound } from '@memory/domain/value-objects/consolidation-round.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const DUE = new Date(NOW.getTime() + UPKEEP_EVERY_MS);
const SOON = new Date(DUE.getTime() + 5_000);
const SESSION = { purpose: 'memory.consolidate', key: 'team_1:0:1' };

const leased = MemoryUpkeepSchedule.first({
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  now: NOW,
}).leaseJob(DUE);
const ROUND = leased.consolidationRound();
const waiting = leased.waitJob(DUE);

const waking = (
  round: ConsolidationRound | null,
  save: (schedule: MemoryUpkeepSchedule) => Promise<void> = async () => {},
) => {
  const saved: MemoryUpkeepSchedule[] = [];
  const consolidator = {
    roundOf: () => round,
  } as unknown as MemoryConsolidatorPort;
  const schedules = {
    ofTeam: async () => waiting,
    save: async (schedule: MemoryUpkeepSchedule) => {
      saved.push(schedule);
      await save(schedule);
    },
  } as unknown as MemoryUpkeepScheduleRepository;

  return {
    saved,
    wake: new WakeUpkeepSweeps(
      consolidator,
      schedules,
      { inTransaction: <T>(work: () => Promise<T>) => work() },
      { now: () => SOON, sleep: async () => undefined },
    ),
  };
};

describe('waking a sweep once its consolidation session settles', () => {
  it('makes the sweep that waits for the session due now', async () => {
    const { wake, saved } = waking(ROUND);

    await wake.settled(SESSION);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.isDue(SOON)).toBe(true);
  });

  it('wakes nothing for a session memory did not order', async () => {
    const { wake, saved } = waking(null);

    await wake.settled({ purpose: 'insights.judge', key: 'run_1:1:1' });

    expect(saved).toEqual([]);
  });

  it('wakes nothing when someone saved the schedule meanwhile', async () => {
    const { wake } = waking(ROUND, async () => {
      throw new MemoryUpkeepScheduleVersionConflictError('team_1');
    });

    await expect(wake.settled(SESSION)).resolves.toBeUndefined();
  });
});
