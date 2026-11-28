import { randomUUID } from 'node:crypto';

import type { RunsPort as AssistRunsPort } from '@assist/application/ports/runs.port';
import { AssistSessionLabels } from '@assist/application/services/assist-session-labels.service';
import { DrizzleAssistSessionReader } from '@assist/infrastructure/persistence/drizzle/readers/assist-session.reader';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { InsightsSessionLabels } from '@insights/infrastructure/acl/assist-session-labels';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { ReplaysRunLabels } from '@replays/application/services/replays-run-labels.service';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { RunJournalsPort } from '@runs/application/ports/run-journals.port';
import { TEAM_HIDDEN_TITLE } from '@runs/application/rendering/run-title.text';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import { RunTitles } from '@runs/application/services/run-titles.service';
import { RunViewing } from '@runs/application/services/run-viewing.service';
import { SpecRunLabels } from '@runs/application/services/spec-run-labels';
import { DrizzleRunnerActivityReader } from '@runs/infrastructure/persistence/drizzle/readers/runner-activity.reader';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  CHAT_RUN_HIDDEN,
  DELETED_TASK_TITLE,
} from '@work/application/rendering/run-labels';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { WorkRunLabels } from '@work/application/services/work-run-labels';
import { DrizzleStationRunReader } from '@work/infrastructure/persistence/drizzle/readers/station-run.reader';
import { DrizzleWorkTitlesReader } from '@work/infrastructure/persistence/drizzle/readers/work-titles.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import {
  aDispatch,
  requestedByChat,
  requestedByReplay,
  requestedBySearch,
  requestedByTask,
} from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

const WORKSPACE = 'ws_titles';
const OTHER_WORKSPACE = 'ws_titles_other';
const TEAM_A = 'team_titles_a';
const TEAM_B = 'team_titles_b';
const ON_A = UserId.of('user_on_a');
const ON_B = UserId.of('user_on_b');

let database: TestDatabase;
let db: DrizzleDatabase;
let activity: DrizzleRunnerActivityReader;
let stationRuns: DrizzleStationRunReader;
let workTitles: DrizzleWorkTitlesReader;
let sessions: DrizzleAssistSessionReader;

beforeAll(async () => {
  database = await openDatabase('run_titles');
  db = database.db;
  activity = new DrizzleRunnerActivityReader(db);
  stationRuns = new DrizzleStationRunReader(
    db,
    partial<RunFactsPort>({}),
    partial<RunJournalsPort>({}),
  );
  workTitles = new DrizzleWorkTitlesReader(db);
  sessions = new DrizzleAssistSessionReader(db);
}, 60_000);

afterAll(async () => {
  await database.close();
});

type RunRow = typeof schema.run.$inferInsert;

type Requested = Pick<
  RunRow,
  | 'requesterOwner'
  | 'requesterKind'
  | 'requesterId'
  | 'requesterToken'
  | 'teamId'
  | 'holdsTurn'
  | 'gated'
  | 'actsBeyondItself'
  | 'asks'
  | 'listed'
  | 'exclusive'
> &
  Partial<RunRow>;

const aRun = (requested: Requested, over: Partial<RunRow> = {}): RunRow => ({
  id: randomUUID(),
  workspaceId: WORKSPACE,
  harness: 'dev',
  state: 'claimed',
  spec: {},
  ...requested,
  ...over,
});

const requestedBySession = (
  sessionId: string,
  teamId: string | null,
): Requested => ({
  requesterOwner: 'assist',
  requesterKind: 'session',
  requesterId: sessionId,
  requesterToken: null,
  teamId,
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
});

const aSession = (input: {
  readonly id?: string;
  readonly workspaceId?: string;
  readonly purpose: string;
  readonly key?: string;
  readonly basedOnRunId: string;
  readonly runId: string;
}): typeof schema.assistSession.$inferInsert => ({
  id: input.id ?? randomUUID(),
  workspaceId: input.workspaceId ?? WORKSPACE,
  purpose: input.purpose,
  key: input.key ?? randomUUID(),
  basedOnRunId: input.basedOnRunId,
  runId: input.runId,
  resultSchema: {},
  status: 'ordered',
  orderedAt: new Date(),
});

/** A task with its line and station, on the team given. */
const aTask = async (input: {
  readonly title: string;
  readonly station: string;
  readonly teamId: string;
}): Promise<{ readonly taskId: string; readonly stationId: string }> => {
  const lineId = randomUUID();
  const stationId = randomUUID();
  const taskId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId: WORKSPACE,
    teamId: input.teamId,
    name: 'Delivery',
  });
  await insertStations(db, {
    id: stationId,
    key: `station-${stationId}`,
    workspaceId: WORKSPACE,
    lineId,
    name: input.station,
    position: 0,
  });
  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId: WORKSPACE,
    stationId,
    title: input.title,
  });

  return { taskId, stationId };
};

describe('the runs of a workspace found by their ids', () => {
  it('finds the runs of the workspace among these, and none of another workspace', async () => {
    const own = aRun(requestedByTask(randomUUID(), { teamId: TEAM_A }));
    const other = aRun(requestedByTask(randomUUID(), { teamId: TEAM_A }), {
      workspaceId: OTHER_WORKSPACE,
    });

    await db.insert(schema.run).values([own, other]);

    const found = await activity.runsOf(WorkspaceId.of(WORKSPACE), [
      RunId.of(own.id),
      RunId.of(other.id),
      RunId.of(randomUUID()),
    ]);

    expect(
      found.map((each) => ({
        runId: each.runId.value,
        teamId: each.teamId,
        listed: each.policy.listed,
        kind: each.requester.kind,
      })),
    ).toEqual([{ runId: own.id, teamId: TEAM_A, listed: true, kind: 'task' }]);
  });

  it('asks the database nothing for no ids', async () => {
    await expect(
      activity.runsOf(WorkspaceId.of(WORKSPACE), []),
    ).resolves.toEqual([]);
  });
});

describe('the task and station each run worked on', () => {
  it('names the task and station of a task run, neither of a chat run, and no task once it is deleted', async () => {
    const { taskId, stationId } = await aTask({
      title: 'Incident owners 2/5',
      station: 'Implementation',
      teamId: TEAM_A,
    });
    const taskRun = randomUUID();
    const goneTaskRun = randomUUID();
    const chatRun = randomUUID();

    await db.insert(schema.dispatch).values([
      aDispatch({ runId: taskRun, taskId, stationId, workspaceId: WORKSPACE }),
      aDispatch({
        runId: goneTaskRun,
        taskId: randomUUID(),
        stationId: randomUUID(),
        workspaceId: WORKSPACE,
      }),
      aDispatch({
        runId: chatRun,
        chatId: randomUUID(),
        workspaceId: WORKSPACE,
      }),
    ]);

    const worked = await stationRuns.workedOn([
      taskRun,
      goneTaskRun,
      chatRun,
      randomUUID(),
    ]);

    expect(
      [...worked].sort((one, other) => one.runId.localeCompare(other.runId)),
    ).toEqual(
      [
        {
          runId: taskRun,
          task: 'Incident owners 2/5',
          station: 'Implementation',
        },
        { runId: goneTaskRun, task: null, station: null },
        { runId: chatRun, task: null, station: null },
      ].sort((one, other) => one.runId.localeCompare(other.runId)),
    );
  });

  it('asks the database nothing for no runs', async () => {
    await expect(stationRuns.workedOn([])).resolves.toEqual([]);
  });
});

describe('the titles of tasks and chats', () => {
  it('reads the title of each task and chat found, and none of one that is gone', async () => {
    const { taskId } = await aTask({
      title: 'Drain the queues',
      station: 'Triage',
      teamId: TEAM_A,
    });
    const chatId = randomUUID();

    await db.insert(schema.chat).values({
      id: chatId,
      workspaceId: WORKSPACE,
      teamId: TEAM_A,
      startedById: ON_A.value,
      title: 'Plan the migration',
      harness: 'dev',
    });

    const [tasks, chats] = await Promise.all([
      workTitles.taskTitles([taskId, randomUUID()]),
      workTitles.chatTitles([chatId, randomUUID()]),
    ]);

    expect([...tasks]).toEqual([[taskId, 'Drain the queues']]);
    expect([...chats]).toEqual([[chatId, 'Plan the migration']]);
    await expect(workTitles.taskTitles([])).resolves.toEqual(new Map());
    await expect(workTitles.chatTitles([])).resolves.toEqual(new Map());
  });
});

describe('the assist sessions found by their ids', () => {
  it('reads the purpose, key and base run of each session found', async () => {
    const session = aSession({
      purpose: 'insights.judge',
      key: 'judge-key',
      basedOnRunId: randomUUID(),
      runId: randomUUID(),
    });

    await db.insert(schema.assistSession).values(session);

    await expect(
      sessions.sessionsOf([session.id, randomUUID()]),
    ).resolves.toEqual([
      {
        id: session.id,
        purpose: 'insights.judge',
        key: 'judge-key',
        basedOnRun: session.basedOnRunId,
      },
    ]);
    await expect(sessions.sessionsOf([])).resolves.toEqual([]);
  });
});

describe('the titles of the runs on the Runners page, for viewers on different teams', () => {
  const titlesFor = () => {
    const labels = new RunRequesterLabels();
    const workRuns = partial<AssistRunsPort>({
      workOf: async (runs) =>
        (await stationRuns.workedOn(runs.map((each) => each.value))).map(
          (each) => ({ ...each, runId: RunId.of(each.runId) }),
        ),
    });
    const sessionLabels = new AssistSessionLabels(sessions, workRuns);

    sessionLabels.register(new InsightsSessionLabels());
    labels.register(new WorkRunLabels(workTitles));
    labels.register(sessionLabels);
    labels.register(new ReplaysRunLabels());
    labels.register(new SpecRunLabels());

    const teamsOf = new Map([
      [ON_A.value, [TEAM_A]],
      [ON_B.value, [TEAM_B]],
    ]);
    const access = partial<WorkspaceAccessPort>({
      mayView: async () => true,
      teamAccessIn: async (_slug, viewer) => ({
        workspaceId: WorkspaceId.of(WORKSPACE),
        teams: [TEAM_A, TEAM_B].map((team) => ({
          teamId: TeamId.of(team),
          sees: true,
          actsOn: teamsOf.get(viewer.value)?.includes(team) ?? false,
          joined: teamsOf.get(viewer.value)?.includes(team) ?? false,
        })),
      }),
    });
    const viewing = new RunViewing(partial<RunFactsPort>({}), access);

    // Work's own rule: every viewer of the workspace reads its task runs, and only the person who started a chat reads its runs.
    viewing.register({
      owner: WorkRequesters.owner,
      readableAmong: async (runs, viewer) =>
        new Set(
          runs.flatMap((run) =>
            run.requester.kind === 'task' ||
            (run.requester.kind === 'chat' && viewer.equals(ON_A))
              ? [run.runId.value]
              : [],
          ),
        ),
    });

    return new RunTitles(labels, viewing, activity, access);
  };

  it('shows each title only to whoever may read it, and says why it is hidden from the others', async () => {
    const { taskId, stationId } = await aTask({
      title: 'Incident owners 2/5',
      station: 'Implementation',
      teamId: TEAM_A,
    });
    const chatId = randomUUID();

    await db.insert(schema.chat).values({
      id: chatId,
      workspaceId: WORKSPACE,
      teamId: TEAM_A,
      startedById: ON_A.value,
      title: 'Plan the migration',
      harness: 'dev',
    });

    const taskRun = aRun(requestedByTask(taskId, { teamId: TEAM_A }), {
      state: 'completed',
      endedAt: new Date(),
    });
    const deletedTaskRun = aRun(
      requestedByTask(randomUUID(), { teamId: TEAM_A }),
    );
    const chatRun = aRun(requestedByChat(chatId, { teamId: TEAM_A }));
    const replayRun = aRun(requestedByReplay(randomUUID(), TEAM_A));
    const searchRun = aRun(
      requestedBySearch(
        { runId: randomUUID(), searchId: randomUUID() },
        TEAM_B,
      ),
    );
    const otherWorkspaceRun = aRun(
      requestedByTask(randomUUID(), { teamId: TEAM_B }),
      { workspaceId: OTHER_WORKSPACE },
    );
    const judgeSession = randomUUID();
    const replayJudgeSession = randomUUID();
    const strayJudgeSession = randomUUID();
    const goneSession = randomUUID();
    const judgeRun = aRun(requestedBySession(judgeSession, TEAM_A));
    const replayJudgeRun = aRun(requestedBySession(replayJudgeSession, TEAM_A));
    const strayJudgeRun = aRun(requestedBySession(strayJudgeSession, TEAM_A));
    const goneSessionRun = aRun(requestedBySession(goneSession, TEAM_B));

    await db
      .insert(schema.run)
      .values([
        taskRun,
        deletedTaskRun,
        chatRun,
        replayRun,
        searchRun,
        otherWorkspaceRun,
        judgeRun,
        replayJudgeRun,
        strayJudgeRun,
        goneSessionRun,
      ]);
    await db.insert(schema.dispatch).values([
      aDispatch({
        runId: taskRun.id,
        taskId,
        stationId,
        workspaceId: WORKSPACE,
        teamId: TEAM_A,
      }),
    ]);
    await db.insert(schema.assistSession).values([
      aSession({
        id: judgeSession,
        purpose: 'insights.judge',
        basedOnRunId: taskRun.id,
        runId: judgeRun.id,
      }),
      aSession({
        id: replayJudgeSession,
        purpose: 'insights.judge',
        basedOnRunId: replayRun.id,
        runId: replayJudgeRun.id,
      }),
      aSession({
        id: strayJudgeSession,
        purpose: 'insights.judge',
        basedOnRunId: otherWorkspaceRun.id,
        runId: strayJudgeRun.id,
      }),
    ]);

    const runs = await activity.runsOf(
      WorkspaceId.of(WORKSPACE),
      [
        taskRun,
        deletedTaskRun,
        chatRun,
        replayRun,
        searchRun,
        otherWorkspaceRun,
        judgeRun,
        replayJudgeRun,
        strayJudgeRun,
        goneSessionRun,
      ].map((each) => RunId.of(each.id)),
    );
    const titles = titlesFor();
    const shownTo = async (viewer: UserId) => {
      const titled = await titles.of(
        { workspaceId: WorkspaceId.of(WORKSPACE), slug: 'titles' },
        runs,
        viewer,
      );

      return (run: { readonly id: string }) => titled.get(run.id);
    };
    const toA = await shownTo(ON_A);
    const toB = await shownTo(ON_B);
    const taskLink = { runId: taskRun.id, teamId: TEAM_A };
    const judging = 'Judging Implementation on “Incident owners 2/5”';

    // A task run, and the judging of it, show to every viewer of the workspace, as the task run itself does.
    for (const shown of [toA, toB]) {
      expect(shown(taskRun)).toEqual({
        title: 'Incident owners 2/5',
        hiddenReason: null,
        link: taskLink,
      });
      expect(shown(judgeRun)).toEqual({
        title: judging,
        hiddenReason: null,
        link: taskLink,
      });
      expect(shown(deletedTaskRun)?.title).toBe(DELETED_TASK_TITLE);
    }

    // A chat run shows only to the person who started the chat.
    expect(toA(chatRun)).toEqual({
      title: 'Plan the migration',
      hiddenReason: null,
      link: null,
    });
    expect(toB(chatRun)).toEqual({
      title: null,
      hiddenReason: CHAT_RUN_HIDDEN,
      link: null,
    });

    // A replay run, and the judging of it, show only to the members of the replay's team.
    expect(toA(replayRun)).toEqual({
      title: 'A replay run',
      hiddenReason: null,
      link: null,
    });
    expect(toA(replayJudgeRun)).toEqual({
      title: 'Judging a run',
      hiddenReason: null,
      link: null,
    });
    for (const run of [replayRun, replayJudgeRun]) {
      expect(toB(run)).toEqual({
        title: null,
        hiddenReason: TEAM_HIDDEN_TITLE,
        link: null,
      });
    }

    // A search run of team B shows to team B only.
    expect(toB(searchRun)?.title).toBe('A search run');
    expect(toA(searchRun)).toEqual({
      title: null,
      hiddenReason: TEAM_HIDDEN_TITLE,
      link: null,
    });

    // Work for a run that is not of this workspace, or for a session that is gone, shows only to the work's own team,
    // and never links to that run.
    expect(toA(strayJudgeRun)).toEqual({
      title: 'Judging a run',
      hiddenReason: null,
      link: null,
    });
    expect(toB(strayJudgeRun)).toEqual({
      title: null,
      hiddenReason: TEAM_HIDDEN_TITLE,
      link: null,
    });
    expect(toB(goneSessionRun)?.title).toBe('Assisting with a run');
    expect(toA(goneSessionRun)?.hiddenReason).toBe(TEAM_HIDDEN_TITLE);
  });
});
