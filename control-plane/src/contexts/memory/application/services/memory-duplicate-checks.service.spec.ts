import type {
  ProposalComparerPort,
  ProposalComparison,
  ProposalComparisonRequest,
} from '@memory/application/ports/proposal-comparer.port';
import { MemoryDuplicateChecks } from '@memory/application/services/memory-duplicate-checks.service';
import { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { MAX_WAIT_MS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T10:00:00.000Z');
const MINUTE = 60_000;
const RUN = RunId.of('run_7');
const TEAM = TeamId.of('team_1');

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const M2 = Memory.write({
  id: MemoryId.of('memory_2'),
  handle: MemoryHandle.of(2),
  workspaceId: WorkspaceId.of('ws_1'),
  kind: 'environment',
  body: MemoryBody.of(
    'qa-tidepool: the runner image has no make/g++, so better-sqlite3 cannot build. Use `npm install --ignore-scripts` (better-sqlite3 still loads) until the image is fixed.',
  ),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: null,
  by: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
});

const PROPOSAL = MemoryProposal.of({
  id: MemoryId.of('proposal_1'),
  kind: 'environment',
  body: MemoryBody.of(
    'npm ci fails in the sandbox on the better-sqlite3 node-gyp build; use npm ci --ignore-scripts.',
  ),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: MemoryProvenance.of({
    taskId: TaskId.of('task_1'),
    runId: RUN,
    steps: [2],
    notes: [],
  }),
  source: 'run',
  supersedes: null,
  recordedAt: NOW,
});

const SET = MemoryProposalSet.rehydrate({
  id: MemoryProposalSetId.of('set_1'),
  taskId: TaskId.of('task_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  proposals: [PROPOSAL],
  version: 1,
});

const REPEATS: ProposalComparison = {
  status: 'compared',
  verdicts: [
    {
      proposal: 'P-1',
      sameAs: 'M-2',
      reason: 'P-1 gives the same advice as M-2.',
    },
  ],
};

const checking = (input: {
  memories?: readonly Memory[];
  answers: readonly ProposalComparison[];
}) => {
  let now = NOW;
  let stored = DuplicateCheck.of({ runId: RUN, set: SET, now: NOW });
  const requests: ProposalComparisonRequest[] = [];

  const checks = {
    of: async () => stored,
    nextDue: async (at: Date) => (stored?.isDue(at) ? stored : null),
    save: async (check: DuplicateCheck) => {
      stored = check;
    },
  } as unknown as DuplicateCheckRepository;
  const comparer: ProposalComparerPort = {
    compare: async (request) => {
      requests.push(request);
      return (
        input.answers[Math.min(requests.length, input.answers.length) - 1] ?? {
          status: 'waiting',
        }
      );
    },
    runOf: () => null,
  };

  const loop = new MemoryDuplicateChecks(
    checks,
    { forTask: async () => SET } as unknown as MemoryProposalSetRepository,
    {
      ofTeam: async () => input.memories ?? [M2],
    } as unknown as MemoryRepository,
    { ofTeam: async () => [] },
    comparer,
    { now: () => now, sleep: async () => undefined },
    QUIET,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { report: () => undefined },
    telemetryInMemory(),
  );

  const tick = async (at: Date) => {
    now = at;
    await loop.processDue();
    await loop.idle();
  };

  return { tick, requests, check: () => stored };
};

describe('a duplicate check of a run’s proposals', () => {
  it('finishes without ordering a session when no proposal has a memory to compare with', async () => {
    const checked = checking({ memories: [], answers: [REPEATS] });

    await checked.tick(NOW);

    expect(checked.requests).toEqual([]);
    expect(checked.check()?.state).toBe('compared');
    expect(checked.check()?.verdicts).toEqual([]);
  });

  it('asks about each proposal with its candidates, based on the run, and waits while the session works', async () => {
    const checked = checking({ answers: [{ status: 'waiting' }] });

    await checked.tick(NOW);

    expect(checked.requests).toEqual([
      {
        workspaceId: 'ws_1',
        run: RUN,
        proposals: [
          {
            ref: 'P-1',
            kind: 'environment',
            body: PROPOSAL.body.value,
            where: 'the whole team',
            candidates: ['M-2'],
          },
        ],
        memories: [
          {
            handle: 'M-2',
            kind: 'environment',
            body: M2.body.value,
            where: 'the whole team',
          },
        ],
      },
    ]);
    expect(checked.check()?.state).toBe('pending');
    expect(checked.check()?.job.attempts).toBe(0);
    expect(checked.check()?.job.waitingSince).toEqual(NOW);
    expect(checked.check()?.isDue(NOW)).toBe(false);
  });

  it('records the verdicts once the session settles', async () => {
    const checked = checking({ answers: [{ status: 'waiting' }, REPEATS] });

    await checked.tick(NOW);
    await checked.tick(new Date(NOW.getTime() + MINUTE));

    expect(checked.requests).toHaveLength(2);
    expect(checked.check()?.state).toBe('compared');
    expect(checked.check()?.repeatOf(PROPOSAL, [M2])).toEqual({
      memory: M2,
      reason: 'P-1 gives the same advice as M-2.',
    });
  });

  it('drops a verdict about a proposal it did not ask about', async () => {
    const checked = checking({
      answers: [
        {
          status: 'compared',
          verdicts: [{ proposal: 'P-9', sameAs: 'M-2', reason: 'Made up.' }],
        },
      ],
    });

    await checked.tick(NOW);

    expect(checked.check()?.state).toBe('compared');
    expect(checked.check()?.verdicts).toEqual([]);
  });

  it('fails when the session fails, so no proposal shows a repeat', async () => {
    const checked = checking({
      answers: [{ status: 'failed', reason: 'no-harness' }],
    });

    await checked.tick(NOW);

    expect(checked.check()?.state).toBe('failed');
    expect(checked.check()?.repeatOf(PROPOSAL, [M2])).toBeNull();
  });

  it('fails once it may wait no longer, instead of being dead-lettered', async () => {
    const checked = checking({ answers: [{ status: 'waiting' }] });
    let at = NOW;

    await checked.tick(at);
    while (checked.check()?.state === 'pending') {
      at = new Date(at.getTime() + MINUTE);
      await checked.tick(at);
    }

    expect(at.getTime() - NOW.getTime()).toBeLessThanOrEqual(MAX_WAIT_MS);
    expect(checked.check()?.state).toBe('failed');
  });
});
