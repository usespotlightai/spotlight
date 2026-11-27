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
import { firstOf } from '@shared-kernel/domain/item-at';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { bodyOf } from './support/body';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { createTeam } from './support/team';

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
  readonly parts?: readonly {
    readonly id: string;
    readonly form: string | null;
    readonly about: string | null;
    readonly open: boolean;
    readonly unread: boolean;
  }[];
}

interface InboxRequestBody {
  readonly id: string;
  readonly taskId: string;
  readonly resolved: boolean;
  readonly unread: boolean;
}

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const proposing = async (
  bodies: readonly string[],
  fromOutside = false,
  kept: { readonly runId: RunId; readonly attempt: number } | null = null,
): Promise<RunId> => {
  const runId = kept?.runId ?? RunId.of(`run_${randomUUID().slice(0, 8)}`);
  const sets = app.get<MemoryProposalSetRepository>(MEMORY_PROPOSAL_SETS);
  const existing = await sets.forTask(team.list.id);
  const remembering = Remembering.of({
    taskId: team.list.id,
    runId,
    asOf: null,
    isolated: false,
    trial: false,
  });
  const drafted = bodies.reduce(
    (set, body) =>
      set.remember(
        remembering.proposalOf({
          id: MemoryId.of(randomUUID()),
          remembered: {
            kind: 'preference',
            body,
            scope: 'team',
            paths: [],
            supersedes: null,
          },
          at: {
            runContext: {
              teamId: team.teamId,
              lineId: LineId.of(team.line.id.value),
              stationId: StationId.of(team.stationId.value),
              repositories: [API],
            },
            steps: [{ index: 5, kind: 'remember' }],
            cited: [],
            fromOutside,
          },
          now: NOW,
        }),
      ),
    existing ??
      MemoryProposalSet.create({
        id: MemoryProposalSetId.of(randomUUID()),
        taskId: team.list.id,
        workspaceId: team.workspaceId,
      }),
  );

  if (existing) {
    await sets.save(drafted);
  } else {
    await sets.add(drafted);
  }

  return runId;
};

const reviewPath = (runId: RunId) =>
  `/api/teams/${team.teamId.value}/tasks/${team.list.id.value}/runs/${runId.value}/memories`;

const inboxIn = async (
  as: string,
  state: 'open' | 'resolved',
): Promise<readonly InboxBody[]> =>
  bodyOf<{ readonly items?: readonly InboxBody[] }>(
    await served(app)
      .get(`/api/workspaces/${team.slug}/inbox?state=${state}`)
      .set(TEST_USER_HEADER, as),
  ).items ?? [];

const inbox = async (as: string): Promise<readonly InboxBody[]> => [
  ...(await inboxIn(as, 'open')),
  ...(await inboxIn(as, 'resolved')),
];

const inboxRequestFor = (
  items: readonly InboxBody[],
  runId: RunId,
): InboxRequestBody | undefined =>
  firstOf(
    items.flatMap((each) =>
      (each.parts ?? []).flatMap((part) =>
        part.form === 'memories' && part.about === runId.value
          ? [
              {
                id: part.id,
                taskId: each.taskId,
                resolved: !part.open,
                unread: part.unread,
              },
            ]
          : [],
      ),
    ),
  );

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `memories-${randomUUID().slice(0, 8)}`,
  );
}, 60_000);

afterAll(async () => {
  await app.close();
});

describe('reviewing the memories a run proposed', () => {
  it('raises one inbox item for a run that proposed three memories', async () => {
    const runId = await proposing(['One.', 'Two.', 'Three.']);

    const item = await eventually(async () =>
      inboxRequestFor(await inbox(team.owner.value), runId),
    );
    const review = await served(app)
      .get(reviewPath(runId))
      .set(TEST_USER_HEADER, team.owner.value);

    expect(item.resolved).toBe(false);
    expect(item.unread).toBe(true);
    expect(
      bodyOf<ReviewBody>(review).memories.map((each) => each.body),
    ).toEqual(['One.', 'Two.', 'Three.']);
  });

  it('makes approved memories active, edited or not, and resolves the item once all are decided', async () => {
    const runId = await proposing(['Approve me.', 'Edit me.', 'Drop me.']);
    await eventually(async () =>
      inboxRequestFor(await inbox(team.owner.value), runId),
    );
    const [approve, edit, drop] = bodyOf<ReviewBody>(
      await served(app)
        .get(reviewPath(runId))
        .set(TEST_USER_HEADER, team.owner.value),
    ).memories;

    const approved = await served(app)
      .post(`${reviewPath(runId)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({
        memories: [{ id: approve.id }, { id: edit.id, body: 'Edited.' }],
      });
    const rejected = await served(app)
      .post(`${reviewPath(runId)}/${drop.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(approved.status).toBe(200);
    expect(rejected.status).toBe(200);
    expect(
      bodyOf<ReviewBody>(rejected).memories.map((each) => [
        each.state,
        each.body,
        each.decision?.name,
      ]),
    ).toEqual([
      ['approved', 'Approve me.', 'Ada'],
      ['approved', 'Edited.', 'Ada'],
      ['rejected', 'Drop me.', 'Ada'],
    ]);

    const active = await eventually(async () => {
      const rows = await db
        .select()
        .from(schema.memory)
        .where(eq(schema.memory.runId, runId.value));
      return rows.length === 2 && rows;
    });
    expect(active.map((each) => each.body).sort()).toEqual([
      'Approve me.',
      'Edited.',
    ]);
    expect(active.every((each) => each.approvedById === team.owner.value)).toBe(
      true,
    );
    expect(active.every((each) => each.steps?.join() === '5')).toBe(true);

    const resolvedItem = await eventually(async () => {
      const item = inboxRequestFor(await inbox(team.owner.value), runId);
      return item?.resolved === true ? item : item?.resolved;
    });
    expect(resolvedItem.resolved).toBe(true);
  });

  it('never stores a rejected memory', async () => {
    const runId = await proposing(['Never approve me.']);
    const only = firstOf(
      bodyOf<ReviewBody>(
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value),
      ).memories,
    );

    await served(app)
      .post(`${reviewPath(runId)}/${only?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);
    await eventually(async () => {
      const item = inboxRequestFor(await inbox(team.owner.value), runId);
      return item?.resolved;
    });

    const stored = await db
      .select()
      .from(schema.memory)
      .where(eq(schema.memory.id, only?.id ?? ''));
    expect(stored).toEqual([]);
  });

  it('restores a rejected memory, opening its inbox item again', async () => {
    const runId = await proposing(['Bring me back.']);
    const only = firstOf(
      bodyOf<ReviewBody>(
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value),
      ).memories,
    );
    await served(app)
      .post(`${reviewPath(runId)}/${only?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);
    await eventually(async () => {
      const item = inboxRequestFor(await inbox(team.owner.value), runId);
      return item?.resolved;
    });

    const restored = await served(app)
      .delete(`${reviewPath(runId)}/${only?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(restored.status).toBe(200);
    expect(
      bodyOf<ReviewBody>(restored).memories.map((each) => [
        each.state,
        each.decision,
      ]),
    ).toEqual([['proposed', null]]);
    const reopened = await eventually(async () => {
      const item = inboxRequestFor(await inbox(team.owner.value), runId);
      return item && !item.resolved && item;
    });
    expect(reopened.resolved).toBe(false);
  });

  it('opens the item of a run again when it proposes more after everything it proposed was decided', async () => {
    const runId = await proposing(['Decide me first.']);
    const only = firstOf(
      bodyOf<ReviewBody>(
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value),
      ).memories,
    );
    await served(app)
      .post(`${reviewPath(runId)}/${only?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);
    await eventually(async () => {
      const item = inboxRequestFor(await inbox(team.owner.value), runId);
      return item?.resolved;
    });

    await proposing(['Ask me after the wait.'], false, { runId, attempt: 2 });

    const reopened = await eventually(async () => {
      const item = inboxRequestFor(await inbox(team.owner.value), runId);
      return item && !item.resolved && item;
    });
    expect(reopened.resolved).toBe(false);
  });

  it('restores only a rejected memory', async () => {
    const runId = await proposing(['Keep me.']);
    const only = firstOf(
      bodyOf<ReviewBody>(
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value),
      ).memories,
    );

    const restored = await served(app)
      .delete(`${reviewPath(runId)}/${only?.id}/reject`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(restored.status).toBe(409);
  });

  it('approves a memory from outside the team only on its own', async () => {
    const runId = await proposing(['Outside one.', 'Outside two.'], true);
    const [first, second] = bodyOf<ReviewBody>(
      await served(app)
        .get(reviewPath(runId))
        .set(TEST_USER_HEADER, team.owner.value),
    ).memories;

    const together = await served(app)
      .post(`${reviewPath(runId)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ memories: [{ id: first.id }, { id: second.id }] });
    const alone = await served(app)
      .post(`${reviewPath(runId)}/approve`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ memories: [{ id: first.id }] });

    expect(first.source).toBe('outside');
    expect(together.status).toBe(422);
    expect(alone.status).toBe(200);
  });

  it('answers a second decision on the same memory with a conflict', async () => {
    const runId = await proposing(['Decide me once.']);
    const only = firstOf(
      bodyOf<ReviewBody>(
        await served(app)
          .get(reviewPath(runId))
          .set(TEST_USER_HEADER, team.owner.value),
      ).memories,
    );

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
    const earlier = firstOf(
      bodyOf<ReviewBody>(
        await served(app)
          .get(reviewPath(first))
          .set(TEST_USER_HEADER, team.owner.value),
      ).memories,
    );
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
      inboxRequestFor(await inbox(team.owner.value), runId),
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
    await db.insert(schema.teamMember).values({
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      userId: teammate,
    });

    await eventually(async () =>
      inboxRequestFor(await inbox(team.owner.value), runId),
    );
    expect(inboxRequestFor(await inbox(teammate), runId)).toBeUndefined();

    await db
      .update(schema.task)
      .set({ assigneeId: null })
      .where(eq(schema.task.id, team.list.id.value));

    const seen = inboxRequestFor(await inbox(teammate), runId);
    expect(seen?.resolved).toBe(false);

    const read = await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/requests/${seen?.id}/read`)
      .set(TEST_USER_HEADER, teammate);
    expect(read.status).toBe(204);
    expect(inboxRequestFor(await inbox(teammate), runId)?.unread).toBe(false);
    expect(inboxRequestFor(await inbox(team.owner.value), runId)?.unread).toBe(
      true,
    );

    await db
      .update(schema.task)
      .set({ assigneeId: team.owner.value })
      .where(eq(schema.task.id, team.list.id.value));
  });
});
