import { randomUUID } from 'node:crypto';

import { MemoryUpkeepSchedule } from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import { MemoryUpkeepVersionConflictError } from '@memory/domain/exceptions/memory-upkeep-version-conflict.error';
import {
  MEMORY_UPKEEP_SCHEDULES,
  MEMORY_UPKEEPS,
  type MemoryUpkeepRepository,
  type MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import type { INestApplication } from '@nestjs/common';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp } from './support/app';
import { createTeam } from './support/team';

const SWEPT = new Date('2099-01-01T10:00:00.000Z');
const LATER = new Date('2099-03-01T10:00:00.000Z');

let app: INestApplication;
let team: Awaited<ReturnType<typeof createTeam>>;
let upkeeps: MemoryUpkeepRepository;
let schedules: MemoryUpkeepScheduleRepository;
let transaction: TransactionPort;

const decided = (at: Date) =>
  MemoryDecision.of({ by: UserId.of(team.owner.value), at });

const sweep = (): MemoryUpkeep => {
  const upkeep = MemoryUpkeep.swept({
    id: MemoryUpkeepId.of(randomUUID()),
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    sweptAt: SWEPT,
    proposals: [
      UpkeepProposal.retiring({
        id: UpkeepProposalId.of(randomUUID()),
        memory: MemoryId.of('memory_1'),
        finding: 'unused',
        reason: 'Not used in 90 days.',
      }),
      UpkeepProposal.merging({
        id: UpkeepProposalId.of(randomUUID()),
        memories: [MemoryId.of('memory_2'), MemoryId.of('memory_3')],
        body: MemoryBody.of('One rule.'),
        reason: 'They say the same.',
      }),
    ],
  });

  if (!upkeep) {
    throw new Error('the sweep proposed nothing');
  }
  return upkeep;
};

beforeAll(async () => {
  app = await openApp();
  team = await createTeam(
    app.get(DRIZZLE),
    app.get(DrizzleTaskRepository),
    `upkeep-${randomUUID().slice(0, 8)}`,
  );
  upkeeps = app.get(MEMORY_UPKEEPS);
  schedules = app.get(MEMORY_UPKEEP_SCHEDULES);
  transaction = app.get(TRANSACTION);
});

afterAll(async () => {
  await app.close();
});

describe('stored upkeep', () => {
  it('keeps each decision, and refuses a save from a stale read', async () => {
    const upkeep = sweep();
    await upkeeps.add(upkeep);
    const [retiring, merging] = upkeep.proposals.map((each) => each.id);

    const stale = await upkeeps.find(upkeep.id);
    if (!stale) {
      throw new Error('the upkeep was not stored');
    }
    await upkeeps.save(upkeep.reject(retiring, decided(SWEPT)));
    const read = await upkeeps.find(upkeep.id);

    expect(read?.proposals.map((each) => each.state)).toEqual([
      'rejected',
      'pending',
    ]);
    expect(read?.proposal(merging).body?.value).toBe('One rule.');
    expect(read?.awaitsDecision).toBe(true);
    await expect(
      upkeeps.save(stale.reject(merging, decided(SWEPT))),
    ).rejects.toBeInstanceOf(MemoryUpkeepVersionConflictError);
  });

  it('holds back what waits for a decision and what was decided since, not what was decided before', async () => {
    const upkeep = sweep();
    await upkeeps.add(upkeep);
    const [retiring] = upkeep.proposals.map((each) => each.id);
    await upkeeps.save(upkeep.reject(retiring, decided(SWEPT)));

    const sinceBefore = await upkeeps.historySince(team.teamId, SWEPT);
    const sinceAfter = await upkeeps.historySince(team.teamId, LATER);

    const mine = (history: typeof sinceBefore) =>
      history
        .filter((each) =>
          each.memoryIds.some((id) =>
            ['memory_1', 'memory_2'].includes(id.value),
          ),
        )
        .map((each) => each.state)
        .sort();
    expect(mine(sinceBefore)).toContain('rejected');
    expect(mine(sinceAfter)).not.toContain('rejected');
    expect(mine(sinceAfter)).toContain('pending');
  });
});

describe('the upkeep schedule', () => {
  it('lets one sweep at a time claim a team that is due', async () => {
    await schedules.add(
      MemoryUpkeepSchedule.first({
        teamId: team.teamId,
        workspaceId: team.workspaceId,
        now: SWEPT,
      }),
    );
    let claimed!: () => void;
    const holding = new Promise<void>((resolve) => {
      claimed = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = transaction.inTransaction(async () => {
      const due = await schedules.nextDue(LATER);
      claimed();
      await released;
      return due;
    });
    await holding;
    const second = await transaction.inTransaction(() =>
      schedules.nextDue(LATER),
    );
    release();

    expect((await first)?.teamId.equals(team.teamId)).toBe(true);
    expect(second?.teamId.equals(team.teamId) ?? false).toBe(false);
  });
});
