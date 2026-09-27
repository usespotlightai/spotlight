import { randomUUID } from 'node:crypto';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { openTeam } from './support/team';

interface Recalled {
  readonly id: string;
  readonly handle: string;
  readonly body: string;
  readonly standing: string;
  readonly grounds: { readonly taskId: string; readonly runId: string } | null;
  readonly superseded?: { readonly handle: string; readonly body: string };
}

interface Proposed {
  readonly id: string;
  readonly kind: string;
  readonly body: string;
  readonly origin: string;
  readonly state: string;
  readonly reach: string;
  readonly repository: string | null;
  readonly paths: readonly string[];
  readonly steps: readonly { readonly index: number; readonly kind: string }[];
}

const HOST = `host-memory-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'m'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
let other: Awaited<ReturnType<typeof openTeam>>;
let runId: string;
let token: string;

const http = () => served(app);

const writing = async (
  teamId: string,
  as: string,
  body: Record<string, unknown>,
): Promise<Recalled> =>
  (
    await http()
      .post(`/api/teams/${teamId}/memories`)
      .set(TEST_USER_HEADER, as)
      .send({ kind: 'rationale', ...body })
      .expect(201)
  ).body as Recalled;

const acp = (update: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ sessionId: 'session_1', update })).toString(
    'base64',
  );

const journalled = async (seq: number, update: Record<string, unknown>) => {
  await http()
    .post(`/api/runs/${runId}/events`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      events: [
        {
          seq,
          type: 'output',
          at: new Date(Date.UTC(2026, 8, 27, 10, 0, seq)).toISOString(),
          data: acp(update),
        },
      ],
    })
    .expect(204);
};

const recall = (words: string, as = token) =>
  http()
    .get(`/api/runs/${runId}/memories`)
    .query({ q: words })
    .set('Authorization', `Bearer ${as}`);

const recallOne = (handle: string) =>
  http()
    .get(`/api/runs/${runId}/memories/${handle}`)
    .set('Authorization', `Bearer ${token}`);

const remember = (body: Record<string, unknown>) =>
  http()
    .post(`/api/runs/${runId}/memories`)
    .set('Authorization', `Bearer ${token}`)
    .send({ kind: 'rationale', ...body });

const claimed = async (): Promise<string> => {
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      name: 'build-box',
      release: '0.1.0',
      executor: 'docker',
      capacity: 1,
      running: [],
      images: [
        { image: IMAGE, usual: true, harnesses: [{ id: 'dev', models: [] }] },
      ],
    })
    .expect(200);

  return (
    (
      await http()
        .post('/api/hosts/claim')
        .set('Authorization', `Bearer ${POOL_TOKEN}`)
        .send({ host: HOST, image: IMAGE })
        .expect(200)
    ).body as { token: string }
  ).token;
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  const tasks = app.get(DrizzleTaskRepository);
  team = await openTeam(db, tasks, `recall-${randomUUID().slice(0, 8)}`);
  other = await openTeam(db, tasks, `elsewhere-${randomUUID().slice(0, 8)}`);

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await db.insert(schema.station).values([
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      lineId: DELIVERY,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
    },
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 2,
      kind: 'completed',
    },
  ]);
  await db
    .insert(schema.lineRepository)
    .values({ lineId: DELIVERY, repository: 'acme/api' });

  await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);

  runId = randomUUID();
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    taskId: team.list.id.value,
    taskRevision: 0,
    stationId: BUILD,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: {
      checkouts: [{ remote: 'spotlight:repository', path: 'api' }],
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the uploads.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: `task:${runId}` },
    },
  });
  token = await claimed();

  await journalled(1, {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'A queue needs a worker we do not run.' },
  });
  await journalled(2, {
    sessionUpdate: 'tool_call',
    toolCallId: 'toolu_1',
    title:
      'spotlight remember --kind rationale --body "Uploads retry in the request."',
    kind: 'execute',
    status: 'pending',
  });
}, 60_000);

afterAll(async () => {
  await forgetRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('recalling what the team remembers from inside a run', () => {
  let standing: Recalled;
  let corrected: Recalled;

  beforeAll(async () => {
    standing = await writing(team.teamId.value, team.owner.value, {
      body: 'Uploads retry in the request, never from a queue.',
    });
    const retired = await writing(team.teamId.value, team.owner.value, {
      body: 'Uploads retry twice before giving up.',
    });
    await http()
      .post(`/api/teams/${team.teamId.value}/memories/${retired.id}/retire`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ reason: 'They retry once now.' })
      .expect(200);
    const wrong = await writing(team.teamId.value, team.owner.value, {
      kind: 'preference',
      body: 'Name branches after people.',
    });
    corrected = (
      await http()
        .post(`/api/teams/${team.teamId.value}/memories/${wrong.id}/edit`)
        .set(TEST_USER_HEADER, team.owner.value)
        .send({ kind: 'preference', body: 'Name branches after the ticket.' })
        .expect(201)
    ).body as Recalled;
    await writing(other.teamId.value, other.owner.value, {
      body: 'Uploads go through the other team’s gateway.',
    });

    const proposedIn = RunId.of(randomUUID());
    await app.get(DrizzleMemoryDraftRepository).add(
      MemoryDraft.opened({
        id: MemoryDraftId.of(randomUUID()),
        taskId: team.list.id,
        workspaceId: team.workspaceId,
      })
        .asked(proposedIn, new Date())
        .drafted({
          runId: proposedIn,
          proposed: [
            {
              kind: 'failure',
              body: 'Uploads time out behind the proxy.',
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
            runId: proposedIn,
            place: {
              teamId: TeamId.of(team.teamId.value),
              lineId: DELIVERY,
              stationId: BUILD,
              repositories: [Repository.of('acme/api')],
            },
            steps: [{ index: 1, kind: 'said', text: 'It timed out.' }],
            notes: [],
            notesRead: 0,
            changed: [],
            standing: [],
            fromOutside: false,
          }),
          newId: () => randomUUID(),
          now: new Date(),
        }),
    );
  });

  it('finds a standing memory by a word in it, and nothing retired, proposed or of another team', async () => {
    const found = await recall('upload');

    expect(found.status).toBe(200);
    expect((found.body as Recalled[]).map((each) => each.body)).toEqual([
      'Uploads retry in the request, never from a queue.',
    ]);
    expect((found.body as Recalled[])[0]?.handle).toBe(standing.handle);
  });

  it('prints one memory in full by its handle, with the memory it replaced', async () => {
    const read = await recallOne(corrected.handle.toLowerCase());

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({
      handle: corrected.handle,
      body: 'Name branches after the ticket.',
      standing: 'stands',
      superseded: { body: 'Name branches after people.' },
    });
    expect((read.body as Recalled).superseded?.handle).toMatch(/^M-\d+$/);
  });

  it('knows no memory of another team by its handle, and refuses what is not a handle', async () => {
    const theirs = await writing(other.teamId.value, other.owner.value, {
      body: 'Ours alone.',
    });

    expect((await recallOne(theirs.handle)).status).toBe(404);
    expect((await recallOne('twelve')).status).toBe(422);
    expect((await recall('   ')).status).toBe(422);
  });

  it('answers only the runner holding the run', async () => {
    expect((await recall('upload', 'not-a-runner-token')).status).toBe(401);
    expect(
      (
        await http()
          .get(`/api/runs/${randomUUID()}/memories`)
          .query({ q: 'upload' })
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(404);
  });
});

describe('remembering from inside a run', () => {
  it('proposes a memory grounded in the step it was asked from, beside the run in the inbox', async () => {
    const proposed = await remember({
      body: 'Uploads retry in the request.',
      paths: ['api/src/uploads'],
    });

    expect(proposed.status).toBe(201);
    expect(proposed.body).toMatchObject({
      kind: 'rationale',
      body: 'Uploads retry in the request.',
      origin: 'remembered',
      state: 'proposed',
      reach: 'line',
      repository: 'acme/api',
      paths: ['src/uploads'],
    });
    expect((proposed.body as Proposed).steps.map((each) => each.kind)).toEqual([
      'remember',
    ]);

    const review = await http()
      .get(
        `/api/teams/${team.teamId.value}/tasks/${team.list.id.value}/runs/${runId}/memories`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .expect(200);
    expect(
      (review.body as { memories: Proposed[] }).memories.map(
        (each) => each.body,
      ),
    ).toContain('Uploads retry in the request.');

    await eventually(async () => {
      const items = (
        await http()
          .get(`/api/workspaces/${team.slug}/inbox`)
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as { aside: { form: string; about: string } | null }[];

      return items.some(
        (each) => each.aside?.form === 'memories' && each.aside.about === runId,
      );
    });
  });

  it('proposes the same memory once, however often it is asked', async () => {
    const first = await remember({ body: 'Staging needs a restart.' });
    const again = await remember({ body: 'Staging needs a restart.' });

    expect((again.body as Proposed).id).toBe((first.body as Proposed).id);
  });

  it('refuses a kind or a path it cannot take, saying what would work', async () => {
    const gossip = await remember({ kind: 'gossip', body: 'Something.' });
    const elsewhere = await remember({
      body: 'Something.',
      paths: ['docs/readme.md'],
    });

    expect(gossip.status).toBe(422);
    expect((gossip.body as { message: string }).message).toContain(
      'rationale, rejected-approach, failure, environment, preference, correction',
    );
    expect(elsewhere.status).toBe(422);
    expect((elsewhere.body as { message: string }).message).toContain('(api)');
  });
});
