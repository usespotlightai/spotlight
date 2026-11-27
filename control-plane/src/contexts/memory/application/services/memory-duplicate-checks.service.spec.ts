import type {
  ProposalComparerPort,
  ProposalComparison,
  ProposalComparisonRequest,
} from '@memory/application/ports/proposal-comparer.port';
import { MemoryDuplicateChecks } from '@memory/application/services/memory-duplicate-checks.service';
import type { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { checkFor } from '@memory/domain/services/duplicate-comparison';
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
const ADA = UserId.of('user_ada');

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const memoryOf = (handle: number, body: string): Memory =>
  Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'environment',
    body: MemoryBody.of(body),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: MemoryDecision.of({ by: ADA, at: NOW }),
  });

const M2 = memoryOf(
  2,
  'qa-tidepool: the runner image has no make/g++, so better-sqlite3 cannot build. Use `npm install --ignore-scripts` (better-sqlite3 still loads) until the image is fixed.',
);

const proposalOf = (id: string, body: string): MemoryProposal =>
  MemoryProposal.of({
    id: MemoryId.of(id),
    kind: 'environment',
    body: MemoryBody.of(body),
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

const PROPOSAL = proposalOf(
  'proposal_1',
  'npm ci fails in the sandbox on the better-sqlite3 node-gyp build; use npm ci --ignore-scripts.',
);

const setOf = (...proposals: MemoryProposal[]) =>
  MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of('set_1'),
    taskId: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    proposals,
    version: 1,
  });

const REPEATS: ProposalComparison = {
  status: 'compared',
  verdicts: [
    {
      proposal: 'P-1',
      sameAs: 'M-2',
      reason: 'It gives the same advice as M-2.',
    },
  ],
};

const checking = (input: {
  set?: MemoryProposalSet | null;
  memories?: readonly Memory[];
  answers: readonly ProposalComparison[];
}) => {
  let now = NOW;
  let set = input.set === undefined ? setOf(PROPOSAL) : input.set;
  let memories = input.memories ?? [M2];
  let stored: DuplicateCheck | null = checkFor({
    set: set ?? setOf(PROPOSAL),
    runId: RUN,
    now: NOW,
  });
  const saved: DuplicateCheck[] = [];
  const requests: ProposalComparisonRequest[] = [];
  const questionsAtRequest: boolean[] = [];
  let linesRead = 0;

  const checks = {
    of: async () => stored,
    nextDue: async (at: Date) => (stored?.isDue(at) ? stored : null),
    save: async (check: DuplicateCheck) => {
      saved.push(check);
      stored = check.isDeleted ? null : check;
    },
  } as unknown as DuplicateCheckRepository;
  const comparer: ProposalComparerPort = {
    compare: async (request) => {
      requests.push(request);
      questionsAtRequest.push(stored?.question !== null);
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
    { forTask: async () => set } as unknown as MemoryProposalSetRepository,
    { ofTeam: async () => memories } as unknown as MemoryRepository,
    {
      ofTeam: async () => {
        linesRead += 1;
        return [];
      },
    },
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

  return {
    tick,
    requests,
    saved,
    questionsAtRequest,
    linesRead: () => linesRead,
    check: () => stored,
    meanwhile: (change: {
      set?: MemoryProposalSet;
      memories?: readonly Memory[];
    }) => {
      set = change.set ?? set;
      memories = change.memories ?? memories;
    },
  };
};

describe('a duplicate check of a run’s proposals', () => {
  it('finishes without ordering a session when no proposal has a memory to compare with', async () => {
    const checked = checking({ memories: [], answers: [REPEATS] });

    await checked.tick(NOW);

    expect(checked.requests).toEqual([]);
    expect(checked.check()?.state).toBe('compared');
    expect(checked.check()?.verdicts).toEqual([]);
  });

  it('records its question before it orders the session with it, and waits while the session works', async () => {
    const checked = checking({ answers: [{ status: 'waiting' }] });

    await checked.tick(NOW);

    expect(checked.questionsAtRequest).toEqual([true]);
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
  });

  it('records the verdicts once the session settles', async () => {
    const checked = checking({ answers: [{ status: 'waiting' }, REPEATS] });

    await checked.tick(NOW);
    await checked.tick(new Date(NOW.getTime() + MINUTE));

    expect(checked.requests).toHaveLength(2);
    expect(checked.check()?.state).toBe('compared');
    expect(checked.check()?.verdictFor(PROPOSAL.id)).toMatchObject({
      repeats: M2.id,
      reason: 'It gives the same advice as M-2.',
    });
  });

  it('reads the answer against the question it asked, after a proposal was approved and a memory added meanwhile', async () => {
    const m3 = memoryOf(3, 'Name branches after the ticket.');
    const a = proposalOf('proposal_a', 'Branches carry the ticket.');
    const b = proposalOf('proposal_b', 'Restart the worker after deploys.');
    const checked = checking({
      set: setOf(a, b),
      memories: [m3],
      answers: [
        { status: 'waiting' },
        {
          status: 'compared',
          verdicts: [
            { proposal: 'P-1', sameAs: 'M-3', reason: 'Same rule as M-3.' },
            { proposal: 'P-2', sameAs: null, reason: 'About deploys.' },
          ],
        },
      ],
    });

    await checked.tick(NOW);
    checked.meanwhile({
      set: setOf(a.approve(MemoryDecision.of({ by: ADA, at: NOW })), b),
      memories: [memoryOf(1, 'Added meanwhile.'), m3],
    });
    await checked.tick(new Date(NOW.getTime() + MINUTE));

    expect(checked.requests[1]).toEqual(checked.requests[0]);
    expect(checked.check()?.verdictFor(a.id)?.repeats).toEqual(m3.id);
    expect(checked.check()?.verdictFor(b.id)?.repeats).toBeNull();
  });

  it('reads the team’s lines only when it asks, not on each later look at the answer', async () => {
    const checked = checking({
      answers: [{ status: 'waiting' }, { status: 'waiting' }, REPEATS],
    });

    await checked.tick(NOW);
    await checked.tick(new Date(NOW.getTime() + MINUTE));
    await checked.tick(new Date(NOW.getTime() + 2 * MINUTE));

    expect(checked.requests).toHaveLength(3);
    expect(checked.linesRead()).toBe(1);
  });

  it('removes itself when its task’s proposals are gone', async () => {
    const checked = checking({ set: null, answers: [REPEATS] });

    await checked.tick(NOW);

    expect(checked.requests).toEqual([]);
    expect(checked.saved[checked.saved.length - 1]?.isDeleted).toBe(true);
    expect(checked.check()).toBeNull();
  });

  it('removes itself when the task’s set is not the one its run proposed in', async () => {
    const checked = checking({
      set: MemoryProposalSet.create({
        id: MemoryProposalSetId.of('set_2'),
        taskId: TaskId.of('task_1'),
        workspaceId: WorkspaceId.of('ws_1'),
      }),
      answers: [REPEATS],
    });

    await checked.tick(NOW);

    expect(checked.check()).toBeNull();
  });

  it('fails when the session fails, so no proposal shows a repeat', async () => {
    const checked = checking({
      answers: [{ status: 'failed', reason: 'no-harness' }],
    });

    await checked.tick(NOW);

    expect(checked.check()?.state).toBe('failed');
    expect(checked.check()?.verdicts).toEqual([]);
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
