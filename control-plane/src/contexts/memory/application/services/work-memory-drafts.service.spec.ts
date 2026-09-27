import { MemoryDraftingError } from '@memory/application/errors/memory-drafting.error';
import type {
  KnownMemoriesPort,
  KnownMemory,
} from '@memory/application/ports/known-memories.port';
import type {
  MemoryDraftAsk,
  MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
import type {
  ChangedFile,
  ReasonedStep,
  SpokenNote,
  WorkedPlace,
  WorkPort,
} from '@memory/application/ports/work.port';
import { WorkMemoryDrafts } from '@memory/application/services/work-memory-drafts.service';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');
const API = Repository.of('acme/api');

const PLACE: WorkedPlace = {
  teamId: TeamId.of('team_1'),
  lineId: 'line_1',
  lineName: 'Delivery',
  stationId: 'station_1',
  stationName: 'Implementation',
  repositories: [API],
};

const STEPS: readonly ReasonedStep[] = [
  { index: 2, kind: 'thought', text: 'A queue needs a worker we do not run.' },
  { index: 5, kind: 'said', text: 'Retrying in the request instead.' },
];

const CHANGED: readonly ChangedFile[] = [
  { repository: API, path: 'src/uploads.ts' },
];

const SPOKEN: readonly SpokenNote[] = [
  { position: 0, by: 'person', text: 'Keep it simple.' },
  { position: 1, by: 'person', text: 'Never retry on a 403.' },
];

const STANDING: readonly KnownMemory[] = [
  { id: 'memory_old', kind: 'preference', body: 'Retry twice.' },
];

const REJECTED: readonly KnownMemory[] = [
  { id: 'memory_no', kind: 'rejected-approach', body: 'Retry forever.' },
];

const REMEMBERED: ProposedMemory = {
  kind: 'correction',
  body: 'Never retry an upload the bucket refused with a 403.',
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
  place?: WorkedPlace | null;
  steps?: readonly ReasonedStep[] | null;
  spoken?: readonly SpokenNote[];
  fromOutside?: boolean;
  held?: MemoryDraft;
}) => {
  let stored =
    input.held ??
    MemoryDraft.opened({
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
      dueForWork: async (at: Date) =>
        stored.drafting?.work.dueBy(at) ? stored : null,
    } as unknown as MemoryDraftRepository,
    {
      run: async () => null,
      placeOf: async () => (input.place === undefined ? PLACE : input.place),
      task: async () => ({
        id: TASK,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        fromOutside: input.fromOutside ?? false,
      }),
      reasoning: async () => (input.steps === undefined ? STEPS : input.steps),
      changedBy: async () => CHANGED,
      spokenOn: async () => input.spoken ?? SPOKEN,
    } satisfies WorkPort,
    {
      standingIn: async () => STANDING,
      rejectedIn: async (_reach, at) => {
        since(at);
        return REJECTED;
      },
    } satisfies KnownMemoriesPort,
    { available: true, draft } as MemoryDrafterPort,
    {
      generate: () => {
        ids += 1;
        return `memory_${ids}`;
      },
    },
    { now: () => NOW, sleep: async () => undefined },
    { run: <T>(work: () => Promise<T>) => work() },
    QUIET,
  );

  const turn = async () => {
    await service.workDue();
    await service.idle();
  };

  return { turn, draft, since, stored: () => stored };
};

describe('drafting what a run should leave the team remembering', () => {
  it('proposes what its evidence grounds, from a person where only a person said it', async () => {
    const worked = working({});

    await worked.turn();

    const [proposal] = worked.stored().proposals;
    expect(worked.stored().owesWork).toBe(false);
    expect(proposal?.body).toBe(
      'Never retry an upload the bucket refused with a 403.',
    );
    expect(proposal?.source).toBe('person');
    expect(proposal?.supersedes?.value).toBe('memory_old');
    expect(proposal?.scope.stationId).toBe('station_1');
  });

  it('asks with the agent’s own words, what people said, and what the team already keeps', async () => {
    const worked = working({});

    await worked.turn();

    expect(worked.draft).toHaveBeenCalledWith({
      lineName: 'Delivery',
      stationName: 'Implementation',
      repositories: ['acme/api'],
      steps: STEPS,
      stepsLeftOut: 0,
      notes: SPOKEN,
      changed: CHANGED,
      standing: STANDING,
      rejected: REJECTED,
    });
    expect(worked.since).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000),
    );
  });

  it('never tells the drafter what a tool returned', async () => {
    const worked = working({});

    await worked.turn();

    const [ask] = worked.draft.mock.calls[0] ?? [];
    expect(JSON.stringify(ask)).not.toMatch(/"returned"|"detail"|"given"/);
    expect(Object.keys(ask?.steps[0] ?? {})).toEqual(['index', 'kind', 'text']);
  });

  it('reads again only the notes people added since the last draft', async () => {
    const first = working({});
    await first.turn();

    const later = working({
      held: first.stored().asked(RunId.of('run_2'), NOW),
      spoken: [...SPOKEN, { position: 2, by: 'person', text: 'Use gzip.' }],
      answer: async () => [],
    });
    await later.turn();

    expect(
      later.draft.mock.calls[0]?.[0].notes.map((each) => each.position),
    ).toEqual([1, 2]);
  });

  it('marks what it proposes from a task that came from outside the team', async () => {
    const worked = working({ fromOutside: true });

    await worked.turn();

    expect(worked.stored().proposals[0]?.source).toBe('outside');
  });

  it('proposes nothing, asking no model, when the run said nothing and nobody spoke', async () => {
    const worked = working({ steps: [], spoken: [] });

    await worked.turn();

    expect(worked.draft).not.toHaveBeenCalled();
    expect(worked.stored().proposals).toEqual([]);
    expect(worked.stored().draftedIn?.equals(RUN)).toBe(true);
  });

  it('keeps nothing and says so when the run’s evidence is gone', async () => {
    const worked = working({ place: null });

    await worked.turn();

    expect(worked.stored().owesWork).toBe(false);
    expect(worked.stored().failure?.code).toBe('no-evidence');
    expect(worked.stored().proposals).toEqual([]);
  });

  it('tries again later when the model provider refuses', async () => {
    const worked = working({
      answer: async () => {
        throw new MemoryDraftingError('refused', '503');
      },
    });

    await worked.turn();

    expect(worked.stored().owesWork).toBe(true);
    expect(worked.stored().drafting?.work.dueAt).toEqual(
      new Date(NOW.getTime() + 30_000),
    );
    expect(worked.stored().proposals).toEqual([]);
  });

  it('tries again later on anything it did not expect', async () => {
    const worked = working({
      answer: async () => {
        throw new Error('connection reset');
      },
    });

    await worked.turn();

    expect(worked.stored().owesWork).toBe(true);
    expect(worked.stored().drafting?.work.attempts).toBe(1);
  });
});
