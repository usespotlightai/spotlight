import { randomUUID } from 'node:crypto';

import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import {
  MEMORY_PROPOSAL_SETS,
  type MemoryProposalSetRepository,
} from '@memory/domain/repositories/memory-proposal-set.repository';
import { Remembering } from '@memory/domain/services/remembering';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { DrizzleRunRepository } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { firstOf } from '@shared-kernel/domain/item-at';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import {
  type BriefingContext,
  TEAM_MEMORIES,
  type TeamMemoriesPort,
} from '@work/application/ports/team-memories.port';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { DrizzleDispatchRepository } from '@work/infrastructure/persistence/drizzle/repositories/dispatch.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { bodyOf } from './support/body';
import { eventually } from './support/eventually';
import { aDispatch } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

interface Written {
  readonly id: string;
  readonly handle: string;
  readonly body: string;
}

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
const DELIVERY = randomUUID();
const DOCS = randomUUID();
const BUILD = randomUUID();
const API = Repository.of('acme/api');

const lineWith = async (id: string, key: string, work: string) => {
  await db.insert(schema.line).values({
    id,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key,
    name: key,
  });
  await insertStations(db, [
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: id,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: work,
      workspaceId: team.workspaceId.value,
      lineId: id,
      key: 'work',
      name: 'Work',
      position: 1,
      kind: 'work',
    },
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: id,
      key: 'completed',
      name: 'Completed',
      position: 2,
      kind: 'completed',
    },
  ]);
  await db
    .insert(schema.lineRepository)
    .values({ lineId: id, repository: 'acme/api' });
};

const writing = async (body: Record<string, unknown>): Promise<Written> =>
  bodyOf<Written>(
    await served(app)
      .post(`/api/teams/${team.teamId.value}/memories`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ kind: 'preference', ...body }),
  );

const briefingContext = (
  over: Partial<BriefingContext> = {},
): BriefingContext => ({
  teamId: TeamId.of(team.teamId.value),
  lineId: DELIVERY,
  stationId: BUILD,
  repositories: [API],
  about: '',
  touched: async () => [{ repository: API, path: 'src/uploads/retry.ts' }],
  ...over,
});

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `briefing-${randomUUID().slice(0, 8)}`,
  );
  await lineWith(DELIVERY, 'delivery', BUILD);
  await lineWith(DOCS, 'docs', randomUUID());
}, 60_000);

afterAll(async () => {
  await app.close();
});

describe('briefing runs with what the team remembers', () => {
  let teamWide: Written;
  let lineOnly: Written;
  let otherLine: Written;
  let byPath: Written;
  let retired: Written;

  beforeAll(async () => {
    teamWide = await writing({ body: 'Name branches after the ticket.' });
    lineOnly = await writing({
      body: 'Delivery squashes its merges.',
      lineId: DELIVERY,
    });
    otherLine = await writing({
      body: 'Docs are written in British English.',
      lineId: DOCS,
    });
    byPath = await writing({
      kind: 'rationale',
      body: 'Uploads retry in the request, not from a queue.',
      repository: 'acme/api',
      paths: ['src/uploads'],
    });
    retired = await writing({ body: 'Deploy on Fridays.' });
    await served(app)
      .post(`/api/teams/${team.teamId.value}/memories/${retired.id}/retire`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ reason: 'Never on Fridays.' });
  });

  const briefed = () => app.get<TeamMemoriesPort>(TEAM_MEMORIES);

  it('gives a run what applies to its place, the most specific first, each by its handle', async () => {
    const { briefed: memories } =
      await briefed().forBriefing(briefingContext());

    expect(memories.map((each) => each.id)).toEqual([
      byPath.id,
      lineOnly.id,
      teamWide.id,
    ]);
    expect(memories[0]?.handle).toMatch(/^M-\d+$/);
    expect(memories[0]?.handle).toBe(byPath.handle);
  });

  it('never gives a line’s memory to another line, nor a retired one to anyone', async () => {
    const { briefed: memories } = await briefed().forBriefing(
      briefingContext({ lineId: DOCS, stationId: null }),
    );
    const ids = memories.map((each) => each.id);

    expect(ids).toContain(otherLine.id);
    expect(ids).not.toContain(lineOnly.id);
    expect(ids).not.toContain(retired.id);
  });

  it('gives a path-scoped memory only once the task has touched its paths', async () => {
    const { briefed: memories } = await briefed().forBriefing(
      briefingContext({ touched: async () => [] }),
    );

    expect(memories.map((each) => each.id)).not.toContain(byPath.id);
  });

  it('reads back what a run was briefed with, in the order of the briefing, apart from what the cap omitted, and counts the run as using them', async () => {
    const runId = RunId.of(randomUUID());
    await app.get(DrizzleRunRepository).add(
      Run.enqueue({
        id: runId,
        workspaceId: team.workspaceId,
        harness: HarnessId.of('codex'),
        ...orderedFor.holdingTurn(
          team.list.id.value,
          0,
          team.teamId,
          'work',
          'task',
        ),
        spec: RunSpec.of({
          checkouts: [],
          command: { executable: 'codex-acp', args: [] },
          briefing: 'Fix the queue.',
          handover: { options: [], noteLimit: 0 },
          resume: {},
        }),
      }),
    );
    await app.get(DrizzleDispatchRepository).add(
      Dispatch.ordered({
        id: runId,
        workspaceId: team.workspaceId,
        teamId: team.teamId,
        subject: {
          kind: 'task',
          taskId: team.list.id,
          revision: TaskRevision.of(0),
          stationId: team.stationId,
          driver: 'line',
        },
        configuredAs: null,
        briefedMemories: BriefedMemories.of({
          briefed: [
            { id: byPath.id, handle: byPath.handle },
            { id: teamWide.id, handle: teamWide.handle },
          ],
          omitted: [{ id: lineOnly.id, handle: lineOnly.handle }],
        }),
        order: DispatchOrder.of({
          kind: 'run',
          runId,
          snapshot: { runId: runId.value },
        }),
        now: new Date(),
      }).enqueuedAsRun(),
    );

    const read = await served(app)
      .get(`/api/teams/${team.teamId.value}/runs/${runId.value}/memories`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(read.status).toBe(200);
    expect(
      bodyOf<{ briefed: Written[] }>(read).briefed.map((each) => each.handle),
    ).toEqual([byPath.handle, teamWide.handle]);
    expect(
      bodyOf<{ omitted: Written[] }>(read).omitted.map((each) => each.handle),
    ).toEqual([lineOnly.handle]);

    const counted = await eventually(async () => {
      const listed = bodyOf<(Written & { runs: number })[]>(
        await served(app)
          .get(`/api/teams/${team.teamId.value}/memories`)
          .set(TEST_USER_HEADER, team.owner.value),
      );
      const runsOf = (id: string) =>
        listed.find((each) => each.id === id)?.runs ?? 0;

      return runsOf(byPath.id) >= 1 && runsOf;
    });
    expect(counted(byPath.id)).toBe(1);
    expect(counted(lineOnly.id)).toBe(0);

    const stored = await eventually(async () => {
      const record = firstOf(
        await db
          .select({ memories: schema.runRecord.memories })
          .from(schema.runRecord)
          .where(eq(schema.runRecord.runId, runId.value)),
      );

      return record !== undefined && record.memories.briefed.length > 0
        ? record.memories
        : null;
    });
    expect(stored).toMatchObject({
      briefed: [byPath.id, teamWide.id].sort(),
      recalled: [],
    });
  });

  it('never briefs a memory still waiting on a person', async () => {
    const runId = RunId.of(randomUUID());
    await app.get<MemoryProposalSetRepository>(MEMORY_PROPOSAL_SETS).add(
      MemoryProposalSet.create({
        id: MemoryProposalSetId.of(randomUUID()),
        taskId: team.list.id,
        workspaceId: team.workspaceId,
      }).remember(
        Remembering.of({
          taskId: team.list.id,
          runId,
          asOf: null,
          isolated: false,
          trial: false,
        }).proposalOf({
          id: MemoryId.of(randomUUID()),
          remembered: {
            kind: 'preference',
            body: 'Still waiting on a person.',
            scope: 'team',
            paths: [],
            supersedes: null,
          },
          at: {
            runContext: {
              teamId: TeamId.of(team.teamId.value),
              lineId: LineId.of(DELIVERY),
              stationId: StationId.of(BUILD),
              repositories: [API],
            },
            steps: [{ index: 1, kind: 'remember' }],
            cited: [],
            fromOutside: false,
          },
          now: new Date(),
        }),
      ),
    );

    const { briefed: memories } =
      await briefed().forBriefing(briefingContext());

    expect(memories.map((each) => each.body)).not.toContain(
      'Still waiting on a person.',
    );
  });

  it('shows a run’s briefed memories to nobody outside its workspace, nor under another team', async () => {
    const runId = RunId.of(randomUUID());
    await app.get(DrizzleRunRepository).add(
      Run.enqueue({
        id: runId,
        workspaceId: team.workspaceId,
        harness: HarnessId.of('claude-code'),
        ...orderedFor.holdingTurn(
          team.list.id.value,
          0,
          team.teamId,
          'work',
          'task',
        ),
        spec: RunSpec.of({
          checkouts: [],
          command: { executable: 'claude-agent-acp', args: [] },
          briefing: 'Fix the queue.',
          handover: { options: [], noteLimit: 0 },
          resume: {},
        }),
      }),
    );
    await db.insert(schema.dispatch).values(
      aDispatch({
        runId: runId.value,
        workspaceId: team.workspaceId.value,
        teamId: team.teamId.value,
        taskId: team.list.id.value,
        stationId: team.stationId.value,
        briefedMemories: {
          briefed: [{ id: teamWide.id, handle: teamWide.handle }],
          omitted: [],
        },
      }),
    );
    const stranger = randomUUID();
    await db.insert(schema.user).values({
      id: stranger,
      name: 'Cy',
      email: `${stranger}@example.com`,
    });
    const otherTeam = randomUUID();
    await db.insert(schema.team).values({
      id: otherTeam,
      workspaceId: team.workspaceId.value,
      key: `other-${otherTeam.slice(0, 6)}`,
      name: 'Other',
      origin: 'configuration',
    });
    await db.insert(schema.teamMember).values({
      workspaceId: team.workspaceId.value,
      teamId: otherTeam,
      userId: team.owner.value,
    });

    const byStranger = await served(app)
      .get(`/api/teams/${team.teamId.value}/runs/${runId.value}/memories`)
      .set(TEST_USER_HEADER, stranger);
    const underOtherTeam = await served(app)
      .get(`/api/teams/${otherTeam}/runs/${runId.value}/memories`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(byStranger.status).toBe(404);
    expect(underOtherTeam.status).toBe(404);
  });

  it('briefs a memory about paths the task has not touched yet when the task is about the same thing', async () => {
    const { briefed: memories } = await briefed().forBriefing(
      briefingContext({
        touched: async () => [],
        about: 'Uploads retry in the request and fail',
      }),
    );

    expect(memories[0]?.id).toBe(byPath.id);
  });

  it('keeps what the cap omitted apart from what it briefs', async () => {
    for (let at = 0; at < 13; at += 1) {
      await writing({ body: `Team-wide memory number ${at}.` });
    }

    const chosen = await briefed().forBriefing(briefingContext());

    expect(chosen.briefed).toHaveLength(8);
    expect(chosen.omitted.length).toBeGreaterThan(0);
    expect(
      chosen.omitted.filter((each) =>
        chosen.briefed.some((one) => one.id === each.id),
      ),
    ).toEqual([]);
  });
});
