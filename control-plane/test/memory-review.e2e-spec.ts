import { randomUUID } from 'node:crypto';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { DrizzleMemoryDraftRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory-draft.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const API = Repository.of('acme/api');

interface ReviewBody {
  readonly runId: string;
  readonly memories: readonly {
    readonly id: string;
    readonly body: string;
    readonly source: string;
    readonly state: string;
    readonly decision: { readonly by: string; readonly name: string } | null;
  }[];
}

interface InboxBody {
  readonly id: string;
  readonly taskId: string;
  readonly resolved: boolean;
  readonly unread: boolean;
  readonly aside: { readonly form: string; readonly about: string } | null;
}

const remembered = (body: string): ProposedMemory => ({
  kind: 'preference',
  body,
  reach: 'team',
  repository: null,
  paths: [],
  steps: [5],
  notes: [],
  supersedes: null,
});

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;

const proposing = async (
  bodies: readonly string[],
  fromOutside = false,
): Promise<RunId> => {
  const runId = RunId.of(`run_${randomUUID().slice(0, 8)}`);
  const drafts = app.get(DrizzleMemoryDraftRepository);
  const held = await drafts.forTask(team.list.id);
  const asked = (
    held ??
    MemoryDraft.opened({
      id: MemoryDraftId.of(randomUUID()),
      taskId: team.list.id,
      workspaceId: team.workspaceId,
    })
  ).asked(runId, NOW);
  const drafted = asked.drafted({
    runId,
    proposed: bodies.map(remembered),
    evidence: DraftEvidence.of({
      taskId: team.list.id,
      runId,
      place: {
        teamId: team.teamId,
        lineId: team.line.id.value,
        stationId: team.stationId.value,
        repositories: [API],
      },
      steps: [
        { index: 5, kind: 'said', text: 'Branches are named for tickets.' },
      ],
      notes: [],
      notesRead: 0,
      changed: [],
      standing: [],
      fromOutside,
    }),
    newId: () => randomUUID(),
    now: NOW,
  });

  if (held) {
    await drafts.save(drafted);
  } else {
    await drafts.add(drafted);
  }

  return runId;
};

const reviewPath = (runId: RunId) =>
  `/api/teams/${team.teamId.value}/tasks/${team.list.id.value}/runs/${runId.value}/memories`;

const inbox = async (as: string): Promise<readonly InboxBody[]> =>
  (
    await served(app)
      .get(`/api/workspaces/${team.slug}/inbox`)
      .set(TEST_USER_HEADER, as)
  ).body;

const asideFor = (items: readonly InboxBody[], runId: RunId) =>
  items.find(
    (each) =>
      each.aside?.form === 'memories' && each.aside.about === runId.value,
  );

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `memories-${randomUUID().slice(0, 8)}`,
  );
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('reviewing the memories a run proposed', () => {
  it('raises one inbox item for a run that proposed three memories', async () => {
    const runId = await proposing(['One.', 'Two.', 'Three.']);

    const item = await eventually(async () =>
      asideFor(await inbox(team.owner.value), runId),
    );
    const review = await served(app)
      .get(reviewPath(runId))
      .set(TEST_USER_HEADER, team.owner.value);

    expect(item.resolved).toBe(false);
    expect(item.unread).toBe(true);
    expect(
      (review.body as ReviewBody).memories.map((each) => each.body),
    ).toEqual(['One.', 'Two.', 'Three.']);
  });

  it('lets approved memories stand, edited or not, and settles the item once all are decided', async () => {
    const runId = await proposing(['Keep me.', 'Edit me.', 'Drop me.']);
    await eventually(async () =>
      asideFor(await inbox(team.owner.value), runId),
    );
    const [keep, edit, drop] = (
      (
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as ReviewBody
    ).memories;

    const approved = await served(app)
      .post(`${reviewPath(runId)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({
        memories: [{ id: keep?.id }, { id: edit?.id, body: 'Edited.' }],
      });
    const rejected = await served(app)
      .post(`${reviewPath(runId)}/${drop?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(approved.status).toBe(200);
    expect(rejected.status).toBe(200);
    expect(
      (rejected.body as ReviewBody).memories.map((each) => [
        each.state,
        each.body,
        each.decision?.name,
      ]),
    ).toEqual([
      ['approved', 'Keep me.', 'Ada'],
      ['approved', 'Edited.', 'Ada'],
      ['rejected', 'Drop me.', 'Ada'],
    ]);

    const standing = await eventually(async () => {
      const rows = await db
        .select()
        .from(schema.memory)
        .where(eq(schema.memory.runId, runId.value));
      return rows.length === 2 && rows;
    });
    expect(standing.map((each) => each.body).sort()).toEqual([
      'Edited.',
      'Keep me.',
    ]);
    expect(standing.every((each) => each.approvedBy === team.owner.value)).toBe(
      true,
    );
    expect(standing.every((each) => each.steps?.join() === '5')).toBe(true);

    const settled = await eventually(async () => {
      const item = asideFor(await inbox(team.owner.value), runId);
      return item?.resolved && item;
    });
    expect(settled.resolved).toBe(true);
  });

  it('never keeps a rejected memory', async () => {
    const runId = await proposing(['Never keep me.']);
    const [only] = (
      (
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as ReviewBody
    ).memories;

    await served(app)
      .post(`${reviewPath(runId)}/${only?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);
    await eventually(async () => {
      const item = asideFor(await inbox(team.owner.value), runId);
      return item?.resolved;
    });

    const kept = await db
      .select()
      .from(schema.memory)
      .where(eq(schema.memory.id, only?.id ?? ''));
    expect(kept).toEqual([]);
  });

  it('approves a memory from outside the team only on its own', async () => {
    const runId = await proposing(['Outside one.', 'Outside two.'], true);
    const [first, second] = (
      (
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as ReviewBody
    ).memories;

    const together = await served(app)
      .post(`${reviewPath(runId)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ memories: [{ id: first?.id }, { id: second?.id }] });
    const alone = await served(app)
      .post(`${reviewPath(runId)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ memories: [{ id: first?.id }] });

    expect(first?.source).toBe('outside');
    expect(together.status).toBe(422);
    expect(alone.status).toBe(200);
  });

  it('answers a second decision on the same memory with a conflict', async () => {
    const runId = await proposing(['Decide me once.']);
    const [only] = (
      (
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as ReviewBody
    ).memories;

    await served(app)
      .post(`${reviewPath(runId)}/${only?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);
    const again = await served(app)
      .post(`${reviewPath(runId)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ memories: [{ id: only?.id }] });

    expect(again.status).toBe(409);
  });

  it('decides a memory only under the run that proposed it', async () => {
    const first = await proposing(['From the first run.']);
    const [earlier] = (
      (
        await served(app)
          .get(reviewPath(first))
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as ReviewBody
    ).memories;
    await served(app)
      .post(`${reviewPath(first)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ memories: [{ id: earlier?.id }] });
    const second = await proposing(['From the second run.']);

    const elsewhere = await served(app)
      .post(`${reviewPath(second)}/${earlier?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(elsewhere.status).toBe(404);
  });

  it('shows nothing to anyone outside the task’s workspace', async () => {
    const runId = await proposing(['Private.']);
    const stranger = randomUUID();
    await db.insert(schema.user).values({
      id: stranger,
      name: 'Cy',
      email: `${stranger}@example.com`,
    });

    const read = await served(app)
      .get(reviewPath(runId))
      .set(TEST_USER_HEADER, stranger);
    await eventually(async () =>
      asideFor(await inbox(team.owner.value), runId),
    );

    expect(read.status).toBe(404);
    expect(
      (
        await served(app)
          .get(`/api/workspaces/${team.slug}/inbox`)
          .set(TEST_USER_HEADER, stranger)
      ).status,
    ).toBe(404);
  });

  it('shows the item of a task nobody is assigned to everyone on the team', async () => {
    const runId = await proposing(['For the team.']);
    const teammate = randomUUID();
    await db.insert(schema.user).values({
      id: teammate,
      name: 'Bea',
      email: `${teammate}@example.com`,
    });
    await db.insert(schema.workspaceMember).values({
      workspaceId: team.workspaceId.value,
      userId: teammate,
      role: 'member',
    });
    await db
      .insert(schema.teamMember)
      .values({ teamId: team.teamId.value, userId: teammate });

    await eventually(async () =>
      asideFor(await inbox(team.owner.value), runId),
    );
    expect(asideFor(await inbox(teammate), runId)).toBeUndefined();

    await db
      .update(schema.task)
      .set({ assigneeId: null })
      .where(eq(schema.task.id, team.list.id.value));

    const seen = asideFor(await inbox(teammate), runId);
    expect(seen?.resolved).toBe(false);

    const read = await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/asides/${seen?.id}/read`)
      .set(TEST_USER_HEADER, teammate);
    expect(read.status).toBe(204);
    expect(asideFor(await inbox(teammate), runId)?.unread).toBe(false);
    expect(asideFor(await inbox(team.owner.value), runId)?.unread).toBe(true);

    await db
      .update(schema.task)
      .set({ assigneeId: team.owner.value })
      .where(eq(schema.task.id, team.list.id.value));
  });
});
