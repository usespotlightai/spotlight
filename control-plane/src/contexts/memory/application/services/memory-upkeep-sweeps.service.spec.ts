import type {
  MemoryConsolidation,
  MemoryConsolidationRequest,
  MemoryConsolidatorPort,
} from '@memory/application/ports/memory-consolidator.port';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { TeamHostRunsPort } from '@memory/application/ports/team-host-runs.port';
import { MemoryUpkeepSweeps } from '@memory/application/services/memory-upkeep-sweeps.service';
import {
  MemoryUpkeepSchedule,
  UPKEEP_EVERY_MS,
} from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import type { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type {
  MemoryUpkeepRepository,
  MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { MAX_WAIT_MS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const DUE = new Date(NOW.getTime() + UPKEEP_EVERY_MS);
const TEAM = TeamId.of('team_1');
const MINUTE = 60_000;

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const memoryOf = (id: string, handle: number, body: string): Memory =>
  Memory.write({
    id: MemoryId.of(id),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(body),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
  });

const MEMORIES = [
  memoryOf('memory_3', 3, 'Name branches after the ticket.'),
  memoryOf('memory_7', 7, 'Every branch carries its ticket number.'),
];

const MERGE: MemoryConsolidation = {
  status: 'consolidated',
  suggestions: [
    {
      change: 'merge',
      handles: ['M-3', 'M-7'],
      body: 'Name each branch after its ticket.',
      reason: 'M-3 and M-7 say the same thing.',
    },
  ],
};

const sweeping = (input: {
  host?: RunId | null;
  answers: readonly MemoryConsolidation[];
}) => {
  let now = DUE;
  let stored = MemoryUpkeepSchedule.first({
    teamId: TEAM,
    workspaceId: WorkspaceId.of('ws_1'),
    now: NOW,
  });
  const upkeeps: MemoryUpkeep[] = [];
  const requests: MemoryConsolidationRequest[] = [];
  let checked = 0;
  let next = 0;

  const schedules = {
    ofTeam: async () => stored,
    ofTeamLocked: async () => stored,
    nextDue: async (at: Date) => (stored.isDue(at) ? stored : null),
    save: async (schedule: MemoryUpkeepSchedule) => {
      stored = schedule;
    },
  } as unknown as MemoryUpkeepScheduleRepository;
  const consolidator: MemoryConsolidatorPort = {
    consolidate: async (request) => {
      requests.push(request);
      return (
        input.answers[Math.min(requests.length, input.answers.length) - 1] ?? {
          status: 'waiting',
        }
      );
    },
    roundOf: () => null,
  };
  const hosts: TeamHostRunsPort = {
    hostOf: async () =>
      input.host === undefined ? RunId.of('run_9') : input.host,
  };

  const sweeps = new MemoryUpkeepSweeps(
    schedules,
    {
      add: async (upkeep: MemoryUpkeep) => {
        upkeeps.push(upkeep);
      },
      historySince: async () => [],
    } as unknown as MemoryUpkeepRepository,
    { ofTeam: async () => MEMORIES } as unknown as MemoryRepository,
    { ofTeam: async () => [] },
    {
      lastUsed: async () => {
        checked += 1;
        return new Map();
      },
    } as unknown as MemoryUsesPort,
    { pathsAt: async () => new Set<string>() },
    consolidator,
    hosts,
    { generate: () => `id_${(next += 1)}` },
    { now: () => now, sleep: async () => undefined },
    QUIET,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { report: () => undefined },
    telemetryInMemory(),
  );

  const tick = async (at: Date) => {
    now = at;
    await sweeps.processDue();
    await sweeps.idle();
  };

  return {
    tick,
    requests,
    upkeeps,
    schedule: () => stored,
    checked: () => checked,
  };
};

describe('a memory upkeep sweep that consolidates in an assist session', () => {
  it('waits for the session, keeping one round and running none of its checks or adding an upkeep while it works', async () => {
    const swept = sweeping({ answers: [{ status: 'waiting' }] });

    await swept.tick(DUE);
    await swept.tick(new Date(DUE.getTime() + MINUTE));

    expect(swept.requests).toHaveLength(2);
    const [first, second] = swept.requests;
    expect(first && second?.round.equals(first.round)).toBe(true);
    expect(swept.requests[0]?.basedOnRun).toEqual(RunId.of('run_9'));
    expect(
      swept.requests[0]?.groups[0]?.memories.map((each) => each.handle),
    ).toEqual(['M-3', 'M-7']);
    expect(swept.upkeeps).toEqual([]);
    expect(swept.checked()).toBe(0);
    expect(swept.schedule().dueAt).toEqual(DUE);
    expect(swept.schedule().job.waitingSince).toEqual(DUE);
  });

  it('adds one upkeep with the changes the session suggested once it settles, and is due again a week later', async () => {
    const swept = sweeping({ answers: [{ status: 'waiting' }, MERGE] });

    await swept.tick(DUE);
    await swept.tick(new Date(DUE.getTime() + MINUTE));

    expect(swept.upkeeps).toHaveLength(1);
    expect(swept.upkeeps[0]?.proposals.map((each) => each.change)).toEqual([
      'merge',
    ]);
    expect(swept.schedule().dueAt.getTime()).toBe(
      DUE.getTime() + MINUTE + UPKEEP_EVERY_MS,
    );
  });

  it('orders no session when no run of the team can host one, and sweeps on', async () => {
    const swept = sweeping({ host: null, answers: [MERGE] });

    await swept.tick(DUE);

    expect(swept.requests).toEqual([]);
    expect(swept.schedule().dueAt.getTime()).toBe(
      DUE.getTime() + UPKEEP_EVERY_MS,
    );
  });

  it('sweeps on with its other checks when the session fails', async () => {
    const swept = sweeping({
      answers: [{ status: 'failed', reason: 'no-harness' }],
    });

    await swept.tick(DUE);

    expect(swept.requests).toHaveLength(1);
    expect(swept.upkeeps).toEqual([]);
    expect(swept.schedule().dueAt.getTime()).toBe(
      DUE.getTime() + UPKEEP_EVERY_MS,
    );
  });
});

describe('a memory upkeep sweep whose session never settles', () => {
  it('sweeps with its other checks once it may wait no longer, instead of being dead-lettered', async () => {
    const swept = sweeping({ answers: [{ status: 'waiting' }] });
    let at = DUE;

    await swept.tick(at);
    while (swept.schedule().dueAt.getTime() === DUE.getTime()) {
      at = new Date(at.getTime() + MINUTE);
      await swept.tick(at);
    }

    expect(at.getTime() - DUE.getTime()).toBeLessThanOrEqual(MAX_WAIT_MS);
    expect(swept.checked()).toBe(1);
    expect(swept.schedule().job.attempts).toBe(0);
    expect(swept.schedule().dueAt.getTime()).toBe(
      at.getTime() + UPKEEP_EVERY_MS,
    );
  });
});
