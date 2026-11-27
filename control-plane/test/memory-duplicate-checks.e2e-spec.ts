import { randomUUID } from 'node:crypto';

import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { DuplicateCheckVersionConflictError } from '@memory/domain/exceptions/duplicate-check-version-conflict.error';
import {
  DUPLICATE_CHECKS,
  type DuplicateCheckRepository,
} from '@memory/domain/repositories/duplicate-check.repository';
import {
  checkFor,
  questionFor,
  repeatShown,
  verdictsFrom,
} from '@memory/domain/services/duplicate-comparison';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { INestApplication } from '@nestjs/common';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp } from './support/app';
import { createTeam } from './support/team';

const NOW = new Date('2099-01-01T10:00:00.000Z');
const LATER = new Date('2099-01-01T10:30:00.000Z');

let app: INestApplication;
let team: Awaited<ReturnType<typeof createTeam>>;
let checks: DuplicateCheckRepository;
let transaction: TransactionPort;

const proposed = () => {
  const runId = RunId.of(`run_${randomUUID()}`);
  const taskId = TaskId.of(`task_${randomUUID()}`);
  const proposal = MemoryProposal.of({
    id: MemoryId.of(`proposal_${randomUUID()}`),
    kind: 'environment',
    body: MemoryBody.of(
      'npm ci fails in the sandbox on the better-sqlite3 node-gyp build; use npm ci --ignore-scripts.',
    ),
    scope: MemoryScope.of({ teamId: team.teamId }),
    provenance: MemoryProvenance.of({ taskId, runId, steps: [1], notes: [] }),
    source: 'run',
    supersedes: null,
    recordedAt: NOW,
  });
  const set = MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of(`set_${randomUUID()}`),
    taskId,
    workspaceId: team.workspaceId,
    proposals: [proposal],
    version: 0,
  });
  const check = checkFor({ set, runId, now: NOW });

  if (!check) {
    throw new Error('the run proposed nothing to compare');
  }
  return { check, set, proposal };
};

const known = (): Memory =>
  Memory.write({
    id: MemoryId.of(`memory_${randomUUID()}`),
    handle: MemoryHandle.of(2),
    workspaceId: team.workspaceId,
    kind: 'environment',
    body: MemoryBody.of(
      'qa-tidepool: the runner image has no make/g++, so better-sqlite3 cannot build.',
    ),
    scope: MemoryScope.of({ teamId: team.teamId }),
    provenance: null,
    by: MemoryDecision.of({ by: UserId.of(team.owner.value), at: NOW }),
  });

beforeAll(async () => {
  app = await openApp();
  team = await createTeam(
    app.get(DRIZZLE),
    app.get(DrizzleTaskRepository),
    `duplicates-${randomUUID().slice(0, 8)}`,
  );
  checks = app.get(DUPLICATE_CHECKS);
  transaction = app.get(TRANSACTION);
});

afterAll(async () => {
  await app?.close();
});

describe('stored duplicate checks', () => {
  it('keeps one check per run, with its verdicts, and refuses a save from a stale read', async () => {
    const { check, set, proposal } = proposed();
    const memory = known();
    await checks.add(check);

    await expect(checks.add(check)).rejects.toBeInstanceOf(
      DuplicateCheckVersionConflictError,
    );

    const stale = await checks.of(check.runId);
    if (!stale) {
      throw new Error('the check was not stored');
    }
    const question = questionFor({
      set,
      runId: check.runId,
      memories: [memory],
      whereOf: () => 'the whole team',
    });
    if (!question) {
      throw new Error('the proposal has nothing to compare with');
    }
    await checks.save(stale.leaseJob(NOW).asking(question));
    const asked = await checks.of(check.runId);
    if (!asked?.question) {
      throw new Error('the question was not stored');
    }
    await checks.save(
      asked.compared(
        verdictsFrom(asked.question, [
          { proposal: 'P-1', sameAs: 'M-2', reason: 'Same as M-2.' },
        ]),
      ),
    );
    const compared = await checks.of(check.runId);

    expect(compared?.state).toBe('compared');
    expect(compared?.question?.proposals.map((each) => each.ref)).toEqual([
      'P-1',
    ]);
    expect(compared?.question?.memories[0]?.where).toBe('the whole team');
    expect(repeatShown(compared, proposal, [memory])?.reason).toBe(
      'Same as M-2.',
    );
    await expect(checks.save(stale.failed())).rejects.toBeInstanceOf(
      DuplicateCheckVersionConflictError,
    );
  });

  it('finds the checks of a task and removes a deleted one', async () => {
    const { check } = proposed();
    await checks.add(check);

    const ofTask = await checks.ofTask(check.taskId);
    for (const each of ofTask) {
      await checks.save(each.delete());
    }

    expect(ofTask.map((each) => each.runId.value)).toEqual([check.runId.value]);
    expect(await checks.of(check.runId)).toBeNull();
  });
});

describe('due duplicate checks', () => {
  it('lets one check at a time be claimed, and none that waits', async () => {
    const waiting = proposed().check;
    await checks.add(waiting);
    await checks.save(waiting.leaseJob(NOW));
    const leased = await checks.of(waiting.runId);
    if (!leased) {
      throw new Error('the check was not stored');
    }
    await checks.save(leased.waitJob(NOW));
    await checks.add(proposed().check);

    let claimed!: () => void;
    const holding = new Promise<void>((resolve) => {
      claimed = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = transaction.inTransaction(async () => {
      const due = await checks.nextDue(NOW);
      claimed();
      await released;
      return due;
    });
    await holding;
    const second = await transaction.inTransaction(() => checks.nextDue(NOW));
    release();
    const one = await first;

    expect(one).not.toBeNull();
    expect(one?.runId.equals(waiting.runId)).toBe(false);
    expect(second?.runId.equals(one?.runId ?? waiting.runId) ?? false).toBe(
      false,
    );
    expect((await checks.of(waiting.runId))?.isDue(LATER)).toBe(true);
  });
});
