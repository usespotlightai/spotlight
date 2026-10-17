import { MemoryDraftingError } from '@memory/application/errors/memory-drafting.error';
import type {
  KnownMemory,
  MemoryDraftAsk,
  MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import type {
  RejectedMemoriesPort,
  RejectedMemory,
} from '@memory/application/ports/rejected-memories.port';
import type {
  ChangedFile,
  NamedStationSite,
  ReasonedStep,
  TaskNote,
  WorkPort,
} from '@memory/application/ports/work.port';
import { MemoriesInReach } from '@memory/application/services/memories-in-reach.service';
import { WorkMemoryDrafts } from '@memory/application/services/work-memory-drafts.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');
const API = Repository.of('acme/api');
const TEAM = TeamId.of('team_1');

const SITE: NamedStationSite = {
  teamId: TEAM,
  lineId: 'line_1',
  lineName: 'Delivery',
  stationId: 'station_1',
  stationName: 'Implementation',
  repositories: [API],
};

const STEPS: readonly ReasonedStep[] = [
  { index: 2, kind: 'thought', text: 'A queue needs a worker we do not run.' },
  { index: 5, kind: 'message', text: 'Retrying in the request instead.' },
];

const CHANGED: readonly ChangedFile[] = [
  { repository: API, path: 'src/uploads.ts' },
];

const NOTES: readonly TaskNote[] = [
  { position: 0, by: 'person', author: null, text: 'Keep it simple.' },
  { position: 1, by: 'person', author: null, text: 'Never retry on a 403.' },
];

const kept = (id: string, scope: MemoryScope, at = NOW) =>
  Memory.write({
    id: MemoryId.of(id),
    handle: MemoryHandle.of(id.length),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of('Retry twice.'),
    scope,
    grounds: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at }),
  });

const CANDIDATES: readonly Memory[] = [
  kept('memory_old', MemoryScope.of({ teamId: TEAM, lineId: 'line_1' })),
  kept('memory_elsewhere', MemoryScope.of({ teamId: TEAM, lineId: 'line_2' })),
];

const ACTIVE: readonly KnownMemory[] = [
  { id: 'memory_old', kind: 'preference', body: 'Retry twice.' },
];

const rejection = (
  id: string,
  scope: MemoryScope,
  decidedAt = NOW,
): RejectedMemory => ({
  id,
  kind: 'rejected-approach',
  body: 'Retry forever.',
  scope,
  decidedAt,
});

const REJECTIONS: readonly RejectedMemory[] = [
  rejection('memory_no', MemoryScope.of({ teamId: TEAM })),
  rejection(
    'memory_other_station',
    MemoryScope.of({ teamId: TEAM, lineId: 'line_1', stationId: 'station_9' }),
  ),
];

const REJECTED: readonly KnownMemory[] = [
  { id: 'memory_no', kind: 'rejected-approach', body: 'Retry forever.' },
];

const REMEMBERED: ProposedMemory = {
  kind: 'correction',
  body: 'Never retry an upload the bucket rejected with a 403.',
  reach: 'station',
  repository: 'acme/api',
  paths: ['src/uploads.ts'],
  steps: [],
  notes: [1],
  supersedes: 'memory_old',
};

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const working = (input: {
  answer?: (ask: MemoryDraftAsk) => Promise<readonly ProposedMemory[]>;
  site?: NamedStationSite | null;
  steps?: readonly ReasonedStep[] | null;
  notes?: readonly TaskNote[];
  fromOutside?: boolean;
  existing?: MemoryDraft;
}) => {
  let stored =
    input.existing ??
    MemoryDraft.create({
      id: MemoryDraftId.of('draft_1'),
      taskId: TASK,
      workspaceId: WorkspaceId.of('ws_1'),
    }).asked(RUN, NOW);
  let ids = 0;
  const draft = vi.fn(input.answer ?? (async () => [REMEMBERED]));
  const since = vi.fn();

  const service = new WorkMemoryDrafts(
    {
      forTask: async () => stored,
      save: async (saved: MemoryDraft) => {
        stored = saved;
      },
      nextDueJob: async (at: Date) =>
        stored.drafting?.job.isDue(at) ? stored : null,
    } as unknown as MemoryDraftRepository,
    {
      run: async () => null,
      leasedBy: async () => null,
      siteOfRun: async () => null,
      referencedUnder: async () => null,
      linesOf: async () => [],
      stationSiteOf: async () => (input.site === undefined ? SITE : input.site),
      task: async () => ({
        id: TASK,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        fromOutside: input.fromOutside ?? false,
      }),
      reasoning: async () => (input.steps === undefined ? STEPS : input.steps),
      changedBy: async () => CHANGED,
      notesOf: async () => input.notes ?? NOTES,
      harnessOf: async () => null,
    } satisfies WorkPort,
    new MemoriesInReach(
      {
        mayReach: async () => CANDIDATES,
        successorsOf: async () => [],
      } as unknown as MemoryRepository,
      {} as MemoryRelevancePort,
    ),
    {
      rejectedOnTeam: async (_team, at) => {
        since(at);
        return REJECTIONS;
      },
    } satisfies RejectedMemoriesPort,
    { available: true, draft } as MemoryDrafterPort,
    {
      generate: () => {
        ids += 1;
        return `memory_${ids}`;
      },
    },
    { now: () => NOW, sleep: async () => undefined },
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    QUIET,
    { report: () => undefined },
  );

  const tick = async () => {
    await service.processDue();
    await service.idle();
  };

  return { tick, draft, since, stored: () => stored };
};

describe('drafting what a run should leave the team remembering', () => {
  it('proposes what its evidence grounds, from a person where it rests only on notes by a person', async () => {
    const worked = working({});

    await worked.tick();

    const [proposal] = worked.stored().proposals;
    expect(worked.stored().hasPendingJob).toBe(false);
    expect(proposal?.body.value).toBe(
      'Never retry an upload the bucket rejected with a 403.',
    );
    expect(proposal?.source).toBe('person');
    expect(proposal?.supersedes?.value).toBe('memory_old');
    expect(proposal?.scope.stationId).toBe('station_1');
  });

  it('asks with the agent’s own words, the notes people wrote, and what the team keeps or turned down where the run worked', async () => {
    const worked = working({});

    await worked.tick();

    expect(worked.draft).toHaveBeenCalledWith({
      lineName: 'Delivery',
      stationName: 'Implementation',
      repositories: ['acme/api'],
      steps: STEPS,
      stepsLeftOut: 0,
      notes: NOTES,
      changed: CHANGED,
      active: ACTIVE,
      proposed: [],
      rejected: REJECTED,
    });
    expect(worked.since).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000),
    );
  });

  it('never tells the drafter what a tool returned', async () => {
    const worked = working({});

    await worked.tick();

    const [ask] = worked.draft.mock.calls[0] ?? [];
    expect(JSON.stringify(ask)).not.toMatch(/"returned"|"detail"|"given"/);
    expect(Object.keys(ask?.steps[0] ?? {})).toEqual(['index', 'kind', 'text']);
  });

  it('reads again only the notes people added since the last draft', async () => {
    const first = working({});
    await first.tick();

    const later = working({
      existing: first.stored().asked(RunId.of('run_2'), NOW),
      notes: [
        ...NOTES,
        { position: 2, by: 'person', author: null, text: 'Use gzip.' },
      ],
      answer: async () => [],
    });
    await later.tick();

    expect(
      later.draft.mock.calls[0]?.[0].notes.map((each) => each.position),
    ).toEqual([1, 2]);
  });

  it('marks what it proposes from a task that came from outside the team', async () => {
    const worked = working({ fromOutside: true });

    await worked.tick();

    expect(worked.stored().proposals[0]?.source).toBe('outside');
  });

  it('proposes nothing, asking no model, when the run has no steps and nobody wrote a note', async () => {
    const worked = working({ steps: [], notes: [] });

    await worked.tick();

    expect(worked.draft).not.toHaveBeenCalled();
    expect(worked.stored().proposals).toEqual([]);
    expect(worked.stored().draftedIn?.equals(RUN)).toBe(true);
  });

  it('keeps nothing and says so when the run’s evidence is gone', async () => {
    const worked = working({ site: null });

    await worked.tick();

    expect(worked.stored().hasPendingJob).toBe(false);
    expect(worked.stored().failure?.code).toBe('no-evidence');
    expect(worked.stored().proposals).toEqual([]);
  });

  it('retries later when the request to the model provider fails', async () => {
    const worked = working({
      answer: async () => {
        throw new MemoryDraftingError('request-failed', '503');
      },
    });

    await worked.tick();

    expect(worked.stored().hasPendingJob).toBe(true);
    expect(worked.stored().drafting?.job.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + 30_000),
    );
    expect(worked.stored().proposals).toEqual([]);
  });

  it('retries later on anything it did not expect', async () => {
    const worked = working({
      answer: async () => {
        throw new Error('connection reset');
      },
    });

    await worked.tick();

    expect(worked.stored().hasPendingJob).toBe(true);
    expect(worked.stored().drafting?.job.attempts).toBe(1);
  });
});
