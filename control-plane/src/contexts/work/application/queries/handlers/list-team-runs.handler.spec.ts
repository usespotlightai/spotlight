import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { FIRST_PAGE } from '@work/application/dto/page.dto';
import type { ChatReaderPort } from '@work/application/ports/chat-reader.port';
import type {
  RunReaderPort,
  TeamRunSummary,
} from '@work/application/ports/run-reader.port';
import {
  ListTeamRunsHandler,
  ReadTeamRunHandler,
} from '@work/application/queries/handlers/list-team-runs.handler';
import {
  ListTeamRunsQuery,
  ReadTeamRunQuery,
} from '@work/application/queries/list-team-runs.query';
import {
  ADMIN_OFF_THE_TEAM,
  audienceOf,
  linesWhere,
  MEMBER,
  OUTSIDE,
  SEES_ONLY,
} from '@work/application/services/run-access.fake-spec';
import { RunAccess } from '@work/application/services/run-access.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { OpenAsk } from '@work/domain/services/conversation-audience';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it, vi } from 'vitest';

const approvalOf = (person: string): OpenAsk => ({
  approval: { open: true, askedOf: UserId.of(person) },
  connectionAsk: null,
});

const waiting = (
  assignee: string | null,
  ask: OpenAsk | null = null,
): TeamRunSummary => ({
  id: 'run_1',
  state: 'suspended',
  progress: null,
  attempt: 1,
  exitCode: null,
  startedAt: new Date('2026-08-28T16:32:47.877Z'),
  updatedAt: new Date('2026-08-28T16:33:25.712Z'),
  endedAt: null,
  harness: 'claude-code',
  image: null,
  ranOn: null,
  waiting: null,
  station: null,
  review: null,
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
  driver: 'line',
  taskId: 'task_1',
  taskTitle: 'Fix the queue',
  taskDescription: null,
});

const reading = (found: TeamRunSummary): RunReaderPort => ({
  listForTask: vi.fn(),
  listForTeam: vi.fn().mockResolvedValue({ items: [found], next: null }),
  findForTeam: vi.fn().mockResolvedValue(found),
  notesFor: vi.fn(),
  taskNotesBetween: vi.fn(),
  taskMoves: vi.fn(),
  configFor: vi.fn(),
});

const access = (standing: TeamStanding) =>
  new RunAccess(
    partial<ChatReaderPort>({ ownershipOf: async () => null }),
    partial<WorkAccess>({
      seesWorkspaceOfTeam: async () => standing.seesTasks,
      standingOn: async () => standing,
    }),
  );

const flagsOf = (
  found: { waitingForYou: boolean; yourMessage: string } | null | undefined,
) =>
  found && {
    waitingForYou: found.waitingForYou,
    yourMessage: found.yourMessage,
  };

const listedFor = async (
  run: TeamRunSummary,
  viewer: string,
  standing: TeamStanding = MEMBER,
) =>
  flagsOf(
    (
      await new ListTeamRunsHandler(
        reading(run),
        access(standing),
        linesWhere(),
      ).execute(new ListTeamRunsQuery('team_1', viewer, FIRST_PAGE))
    ).items[0],
  );

const readFor = async (
  run: TeamRunSummary,
  viewer: string,
  standing: TeamStanding = MEMBER,
) =>
  flagsOf(
    await new ReadTeamRunHandler(
      reading(run),
      access(standing),
      linesWhere(),
    ).execute(new ReadTeamRunQuery('team_1', 'run_1', viewer)),
  );

describe.each([
  ['ListTeamRunsHandler', listedFor],
  ['ReadTeamRunHandler', readFor],
])('%s', (_name, seenBy) => {
  it('waits for Alice, who is the assignee, and refuses a message from Bob on the same team', async () => {
    await expect(seenBy(waiting('user_alice'), 'user_alice')).resolves.toEqual({
      waitingForYou: true,
      yourMessage: 'answer',
    });
    await expect(seenBy(waiting('user_alice'), 'user_bob')).resolves.toEqual({
      waitingForYou: false,
      yourMessage: 'awaits-another',
    });
  });

  it('waits for a member while the task has no assignee, and not for an admin off the team', async () => {
    await expect(seenBy(waiting(null), 'user_bob')).resolves.toEqual({
      waitingForYou: true,
      yourMessage: 'answer',
    });
    await expect(
      seenBy(waiting(null), 'user_admin', ADMIN_OFF_THE_TEAM),
    ).resolves.toEqual({ waitingForYou: false, yourMessage: 'awaits-another' });
  });

  it('waits for an admin off the team whom an approval asks by name, and refuses their message, which would hold the task', async () => {
    await expect(
      seenBy(
        waiting('user_alice', approvalOf('user_admin')),
        'user_admin',
        ADMIN_OFF_THE_TEAM,
      ),
    ).resolves.toEqual({ waitingForYou: true, yourMessage: 'not-on-team' });
  });

  it('puts the task on hold on a message from the assignee while an approval waits', async () => {
    await expect(
      seenBy(waiting('user_alice', approvalOf('user_bob')), 'user_alice'),
    ).resolves.toEqual({ waitingForYou: true, yourMessage: 'holds' });
  });

  it('waits for nobody who only sees the team, even when it asks them by name', async () => {
    await expect(
      seenBy(
        waiting('user_alice', approvalOf('user_carol')),
        'user_carol',
        SEES_ONLY,
      ),
    ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-acting' });
    await expect(
      seenBy(waiting('user_alice'), 'user_alice', SEES_ONLY),
    ).resolves.toEqual({ waitingForYou: false, yourMessage: 'not-acting' });
  });
});

describe('runs of the team for a person outside the workspace', () => {
  it('lists none', async () => {
    await expect(
      listedFor(waiting(null), 'user_stranger', OUTSIDE),
    ).resolves.toBeUndefined();
  });

  it('reads none', async () => {
    await expect(
      readFor(waiting(null), 'user_stranger', OUTSIDE),
    ).resolves.toBeNull();
  });
});
