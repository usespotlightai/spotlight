import type { RunUsageFacts } from '@runs/application/ports/run-usage-reader.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  RunNotesSummary,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import { ReadRunNotesHandler } from '@work/application/queries/handlers/read-run-notes.handler';
import { ReadRunNotesQuery } from '@work/application/queries/read-run-notes.query';
import {
  ADMIN_OFF_THE_TEAM,
  audienceOf,
  inWorkspace,
  linesWhere,
  OUTSIDE,
  runAccessWhere,
  SEES_ONLY,
} from '@work/application/services/run-access.fake-spec';
import type { OpenAsk } from '@work/domain/services/conversation-audience';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN_ID = '4e1e84a2-0c39-406d-bbbb-559f29e450be';

const notes: RunNotesSummary = {
  runId: RUN_ID,
  taskId: 'task_1',
  title: 'Fix the queue',
  description: null,
  attachments: [],
  station: null,
  createdAt: new Date('2026-09-30T10:00:00Z'),
  briefing: 'Fix the queue so it drains.',
  progress: null,
  latestRun: {
    id: RUN_ID,
    state: 'completed',
    progress: null,
    audience: audienceOf(),
  },
  notes: [],
  folded: [],
};

const approvalOf = (person: string): OpenAsk => ({
  approval: { open: true, askedOf: UserId.of(person) },
  connectionAsk: null,
});

const usage: RunUsageFacts = {
  ms: 60_000,
  steps: 12,
  errors: 0,
  changedLines: 0,
  contextTokens: 40_000,
  contextWindow: 200_000,
  cost: { amount: 0.42, currency: 'USD' },
  tokens: { input: 1_200, output: 900, cacheRead: 80_000, cacheWrite: null },
};

const reading = (
  found: RunNotesSummary | null,
  usages: ReadonlyMap<string, RunUsageFacts>,
  viewer = 'user_1',
  standing?: TeamStanding,
) =>
  new ReadRunNotesHandler(
    {
      listForTask: vi.fn(),
      listForTeam: vi.fn(),
      findForTeam: vi.fn(),
      notesFor: vi.fn().mockResolvedValue(found && inWorkspace(found)),
      taskNotesBetween: vi.fn(),
      configFor: vi.fn(),
    } satisfies RunReaderPort,
    { forRuns: async () => new Map(usages) },
    runAccessWhere(true, standing),
    linesWhere(),
  ).execute(new ReadRunNotesQuery(RUN_ID, viewer));

const waitingOn = (
  assignee: string | null,
  ask: OpenAsk | null = null,
): RunNotesSummary => ({
  ...notes,
  latestRun: {
    id: RUN_ID,
    state: 'suspended',
    progress: null,
    audience: audienceOf({
      waits: true,
      task: {
        running: true,
        pending: {
          assignee: nonEmpty(assignee) ? UserId.of(assignee) : null,
          ask,
        },
      },
      to: { currentRun: true, atTaskStation: true },
    }),
  },
});

const seenBy = async (
  found: RunNotesSummary,
  viewer: string,
  standing?: TeamStanding,
) => {
  const read = await reading(found, new Map(), viewer, standing);

  return (
    read && {
      waitingForYou: read.latestRun.waitingForYou,
      yourMessage: read.latestRun.yourMessage,
    }
  );
};

describe('ReadRunNotesHandler', () => {
  it('finds nothing for a run the viewer cannot see', async () => {
    expect(await reading(null, new Map([[RUN_ID, usage]]))).toBeNull();
  });

  it('shows what an ended run spent, with a count never reported left unknown', async () => {
    const found = await reading(notes, new Map([[RUN_ID, usage]]));

    expect(found?.spend).toEqual({
      cost: 0.42,
      currency: 'USD',
      inputTokens: 1_200,
      outputTokens: 900,
      cacheReadTokens: 80_000,
      cacheWriteTokens: null,
    });
  });

  it('shows no spend for a run whose usage is not yet recorded', async () => {
    const found = await reading(notes, new Map());

    expect(found?.spend).toBeNull();
  });

  it('says the latest run waits for Alice, who is the assignee, and refuses a message from Bob', async () => {
    await expect(
      seenBy(waitingOn('user_alice'), 'user_alice'),
    ).resolves.toEqual({ waitingForYou: true, yourMessage: 'answer' });
    await expect(seenBy(waitingOn('user_alice'), 'user_bob')).resolves.toEqual({
      waitingForYou: false,
      yourMessage: 'awaits-another',
    });
  });

  it('says it waits for a member while the task has no assignee, and not for an admin off the team', async () => {
    await expect(seenBy(waitingOn(null), 'user_bob')).resolves.toEqual({
      waitingForYou: true,
      yourMessage: 'answer',
    });
    await expect(
      seenBy(waitingOn(null), 'user_admin', ADMIN_OFF_THE_TEAM),
    ).resolves.toEqual({ waitingForYou: false, yourMessage: 'awaits-another' });
  });

  it('says an approval that asks Bob by name waits for him, and that a message from him puts the task on hold', async () => {
    await expect(
      seenBy(waitingOn('user_alice', approvalOf('user_bob')), 'user_bob'),
    ).resolves.toEqual({ waitingForYou: true, yourMessage: 'holds' });
  });

  it('says a message from an admin off the team to a run at the task’s station is refused, because it would hold the task', async () => {
    await expect(
      seenBy(
        {
          ...notes,
          latestRun: {
            ...notes.latestRun,
            audience: audienceOf({ to: { atTaskStation: true } }),
          },
        },
        'user_admin',
        ADMIN_OFF_THE_TEAM,
      ),
    ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-on-team' });
  });

  it('lets Alice, who is the assignee, Bob and an admin off the team stop the latest run, which an admin cannot message', async () => {
    const working: RunNotesSummary = {
      ...notes,
      latestRun: {
        ...notes.latestRun,
        state: 'claimed',
        progress: 'in-progress',
        audience: audienceOf({ to: { currentRun: true, atTaskStation: true } }),
      },
    };
    const stoppableBy = async (viewer: string, standing?: TeamStanding) => {
      const read = await reading(working, new Map(), viewer, standing);

      return (
        read && {
          stoppableByYou: read.latestRun.stoppableByYou,
          yourMessage: read.latestRun.yourMessage,
        }
      );
    };

    await expect(stoppableBy('user_alice')).resolves.toEqual({
      stoppableByYou: true,
      yourMessage: 'holds',
    });
    await expect(stoppableBy('user_bob')).resolves.toEqual({
      stoppableByYou: true,
      yourMessage: 'holds',
    });
    await expect(
      stoppableBy('user_admin', ADMIN_OFF_THE_TEAM),
    ).resolves.toEqual({ stoppableByYou: true, yourMessage: 'not-on-team' });
    await expect(stoppableBy('user_reader', SEES_ONLY)).resolves.toEqual({
      stoppableByYou: false,
      yourMessage: 'not-acting',
    });
  });

  it('says it waits for nobody who does not act on the team, and refuses their message', async () => {
    for (const standing of [SEES_ONLY, OUTSIDE]) {
      await expect(
        seenBy(waitingOn('user_alice'), 'user_alice', standing),
      ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-acting' });
      await expect(
        seenBy(
          waitingOn(null, approvalOf('user_carol')),
          'user_carol',
          standing,
        ),
      ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-acting' });
    }
  });

  it('says it waits for nobody while the latest run waits for no person, and refuses a message to it once the task has left its station', async () => {
    await expect(seenBy(notes, 'user_1')).resolves.toEqual({
      waitingForYou: false,
      yourMessage: 'moved-on',
    });
  });
});
