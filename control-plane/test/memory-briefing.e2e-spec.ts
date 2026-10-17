import { randomUUID } from 'node:crypto';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import {
  type BriefingPlace,
  TEAM_MEMORIES,
  type TeamMemoriesPort,
} from '@work/application/ports/team-memories.port';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { openTeam } from './support/team';

interface Written {
  readonly id: string;
  readonly handle: string;
  readonly body: string;
}

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
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
  await db.insert(schema.station).values([
    {
      id: randomUUID(),
      lineId: id,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: work,
      lineId: id,
      key: 'work',
      name: 'Work',
      position: 1,
      kind: 'work',
    },
    {
      id: randomUUID(),
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
  (
    await served(app)
      .post(`/api/teams/${team.teamId.value}/memories`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ kind: 'preference', ...body })
  ).body as Written;

const place = (over: Partial<BriefingPlace> = {}): BriefingPlace => ({
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
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `briefing-${randomUUID().slice(0, 8)}`,
  );
  await lineWith(DELIVERY, 'delivery', BUILD);
  await lineWith(DOCS, 'docs', randomUUID());
}, 60_000);

afterAll(async () => {
  await app?.close();
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

  it('gives a run what reaches its place, the most specific first, each by its handle', async () => {
    const { briefed: memories } = await briefed().forBriefing(place());

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
      place({ lineId: DOCS, stationId: null }),
    );
    const ids = memories.map((each) => each.id);

    expect(ids).toContain(otherLine.id);
    expect(ids).not.toContain(lineOnly.id);
    expect(ids).not.toContain(retired.id);
  });

  it('gives a path-scoped memory only once the task has touched its paths', async () => {
    const { briefed: memories } = await briefed().forBriefing(
      place({ touched: async () => [] }),
    );

    expect(memories.map((each) => each.id)).not.toContain(byPath.id);
  });

  it('reads back what a run was briefed with, in the order it was told, apart from what the cap cut, and counts the run as using them', async () => {
    const runId = RunId.of(randomUUID());
    await app.get(DrizzleRunRepository).add(
      Run.enqueue({
        id: runId,
        workspaceId: team.workspaceId,
        harness: HarnessId.of('codex'),
        subject: RunSubject.task(
          team.list.id,
          team.stationId,
          TaskRevision.of(0),
        ),
        spec: RunSpec.of({
          checkouts: [],
          command: { executable: 'codex-acp', args: [] },
          briefing: 'Fix the queue.',
          handover: { options: [], noteLimit: 0 },
          continuity: { key: 'task_1' },
        }),
        briefedWith: BriefedMemories.of({
          briefed: [
            { id: byPath.id, handle: byPath.handle },
            { id: teamWide.id, handle: teamWide.handle },
          ],
          cut: [{ id: lineOnly.id, handle: lineOnly.handle }],
        }),
      }),
    );

    const read = await served(app)
      .get(`/api/teams/${team.teamId.value}/runs/${runId.value}/memories`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(read.status).toBe(200);
    expect(
      (read.body as { briefed: Written[] }).briefed.map((each) => each.handle),
    ).toEqual([byPath.handle, teamWide.handle]);
    expect(
      (read.body as { cut: Written[] }).cut.map((each) => each.handle),
    ).toEqual([lineOnly.handle]);

    const counted = await eventually(async () => {
      const listed = (
        await served(app)
          .get(`/api/teams/${team.teamId.value}/memories`)
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as (Written & { runs: number })[];
      const runsOf = (id: string) =>
        listed.find((each) => each.id === id)?.runs ?? 0;

      return runsOf(byPath.id) >= 1 && runsOf;
    });
    expect(counted(byPath.id)).toBe(1);
    expect(counted(lineOnly.id)).toBe(0);

    const kept = await eventually(async () => {
      const [record] = await db
        .select({ memories: schema.runRecord.memories })
        .from(schema.runRecord)
        .where(eq(schema.runRecord.runId, runId.value));

      return record?.memories.briefed.length ? record.memories : null;
    });
    expect(kept).toEqual({
      briefed: [byPath.id, teamWide.id].sort(),
      recalled: [],
    });
  });

  it('never briefs a memory still waiting on a person', async () => {
    const runId = RunId.of(randomUUID());
    await app.get(DrizzleMemoryDraftRepository).add(
      MemoryDraft.open({
        id: MemoryDraftId.of(randomUUID()),
        taskId: team.list.id,
        workspaceId: team.workspaceId,
      })
        .asked(runId, new Date())
        .recordDraft({
          runId,
          proposed: [
            {
              kind: 'preference',
              body: 'Still waiting on a person.',
              reach: 'team',
              repository: null,
              paths: [],
              steps: [1],
              notes: [],
              supersedes: null,
            },
          ],
          evidence: DraftEvidence.of({
            taskId: team.list.id,
            runId,
            site: {
              teamId: TeamId.of(team.teamId.value),
              lineId: DELIVERY,
              stationId: BUILD,
              repositories: [API],
            },
            steps: [{ index: 1, kind: 'said', text: 'Said it.' }],
            notes: [],
            notesRead: 0,
            changed: [],
            known: [],
            fromOutside: false,
          }),
          newId: () => randomUUID(),
          now: new Date(),
        }),
    );

    const { briefed: memories } = await briefed().forBriefing(place());

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
        subject: RunSubject.task(
          team.list.id,
          team.stationId,
          TaskRevision.of(0),
        ),
        spec: RunSpec.of({
          checkouts: [],
          command: { executable: 'claude-agent-acp', args: [] },
          briefing: 'Fix the queue.',
          handover: { options: [], noteLimit: 0 },
          continuity: { key: 'task_2' },
        }),
        briefedWith: BriefedMemories.of({
          briefed: [{ id: teamWide.id, handle: teamWide.handle }],
          cut: [],
        }),
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
      place({
        touched: async () => [],
        about: 'Uploads retry in the request and fail',
      }),
    );

    expect(memories[0]?.id).toBe(byPath.id);
  });

  it('keeps what the cap cut apart from what it briefs', async () => {
    for (let at = 0; at < 13; at += 1) {
      await writing({ body: `Team-wide memory number ${at}.` });
    }

    const chosen = await briefed().forBriefing(place());

    expect(chosen.briefed).toHaveLength(8);
    expect(chosen.cut.length).toBeGreaterThan(0);
    expect(
      chosen.cut.filter((each) =>
        chosen.briefed.some((one) => one.id === each.id),
      ),
    ).toEqual([]);
  });
});
