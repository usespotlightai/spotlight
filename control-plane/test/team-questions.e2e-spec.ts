import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { createTeam } from './support/team';

interface Entry {
  readonly kind: string;
  readonly id: string;
  readonly taskId?: string;
  readonly standing?: string;
  readonly section: string;
  readonly unread?: boolean;
}

const NOW = new Date('2026-11-14T09:00:00.000Z');

let app: INestApplication;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;
let team: Awaited<ReturnType<typeof createTeam>>;
let ben: UserId;
let cy: UserId;
let dee: UserId;

const person = async (
  name: string,
  onTeam: boolean,
  role: 'member' | 'admin' = 'member',
): Promise<UserId> => {
  const id = randomUUID();

  await db.insert(schema.user).values({ id, name, email: `${id}@example.com` });
  await db.insert(schema.workspaceMember).values({
    workspaceId: team.workspaceId.value,
    userId: id,
    role,
  });

  if (onTeam) {
    await db.insert(schema.teamMember).values({
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      userId: id,
    });
  }

  return UserId.of(id);
};

const note = (voice: Voice = Voice.station()) => ({
  line: team.line,
  body: TaskNoteBody.of('Which region does the alert come from?'),
  at: NOW,
  voice,
});

const asked = async (shaped: (task: Task) => Task = (task) => task) => {
  const task = shaped(
    Task.add({
      line: team.line,
      at: team.stationId,
      title: TaskTitle.of('Alert fired'),
      rank: TaskRank.of(randomUUID().replaceAll('-', '')),
      now: NOW,
      newId: () => randomUUID(),
    }),
  ).askedAbout(note(), null);

  await tasks.add(task);

  return task.id.value;
};

const inboxOf = async (viewer: UserId): Promise<readonly Entry[]> =>
  (
    (
      await served(app)
        .get(`/api/workspaces/${team.slug}/inbox`)
        .set(TEST_USER_HEADER, viewer.value)
        .expect(200)
    ).body as { readonly items: Entry[] }
  ).items;

const entryOf = async (viewer: UserId, taskId: string) =>
  (await inboxOf(viewer)).find(
    (each) => each.kind === 'task' && each.taskId === taskId,
  );

const assigneeOf = async (taskId: string) =>
  (await tasks.find(TaskId.of(taskId)))?.assignee?.value ?? null;

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  tasks = app.get(DrizzleTaskRepository);
  team = await createTeam(db, tasks, `team-q-${randomUUID().slice(0, 8)}`);
  ben = await person('Ben', true);
  cy = await person('Cy', false);
  dee = await person('Dee', false, 'admin');
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('a question on a task without an assignee', () => {
  it('waits in the inbox of everyone who acts on the team', async () => {
    const taskId = await asked();

    expect(await entryOf(team.owner, taskId)).toMatchObject({
      standing: 'team',
      section: 'open',
    });
    expect(await entryOf(ben, taskId)).toMatchObject({ standing: 'team' });
    expect(await entryOf(cy, taskId)).toBeUndefined();
  });

  it('goes to the person who takes it, and leaves the other inboxes', async () => {
    const taskId = await asked();
    const item = await entryOf(ben, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/take`)
      .set(TEST_USER_HEADER, ben.value)
      .expect(204);

    expect(await assigneeOf(taskId)).toBe(ben.value);
    expect(await entryOf(ben, taskId)).toMatchObject({
      standing: 'assignee',
    });
    expect(await entryOf(team.owner, taskId)).toBeUndefined();

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/take`)
      .set(TEST_USER_HEADER, team.owner.value)
      .expect(404);
  });

  it('goes to the first person who answers it', async () => {
    const taskId = await asked();
    const item = await entryOf(team.owner, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/answer`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ body: 'From eu-west-1.' })
      .expect(204);

    expect(await assigneeOf(taskId)).toBe(team.owner.value);
    expect(await entryOf(ben, taskId)).toBeUndefined();
  });

  it('goes to the first person who resolves it', async () => {
    const taskId = await asked();
    const item = await entryOf(ben, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/resolve`)
      .set(TEST_USER_HEADER, ben.value)
      .expect(204);

    expect(await assigneeOf(taskId)).toBe(ben.value);
  });

  it('refuses a take from a member who follows it once another member took it', async () => {
    const taskId = await asked((task) =>
      task.addMessage(note(Voice.person(ben))),
    );
    const item = await entryOf(ben, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/take`)
      .set(TEST_USER_HEADER, team.owner.value)
      .expect(204);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/take`)
      .set(TEST_USER_HEADER, ben.value)
      .expect(409);

    expect(await assigneeOf(taskId)).toBe(team.owner.value);
  });

  it('refuses a take once nothing waits on anyone', async () => {
    const taskId = await asked();
    const item = await entryOf(ben, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/resolve`)
      .set(TEST_USER_HEADER, ben.value)
      .expect(204);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/take`)
      .set(TEST_USER_HEADER, ben.value)
      .expect(409);
  });

  it('stays out of the inbox of an admin who is not on the team, who cannot answer it', async () => {
    const taskId = await asked();
    const item = await entryOf(ben, taskId);

    expect(await entryOf(dee, taskId)).toBeUndefined();

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/answer`)
      .set(TEST_USER_HEADER, dee.value)
      .send({ body: 'From eu-west-1.' })
      .expect(404);

    expect(await assigneeOf(taskId)).toBeNull();
  });

  it('refuses a take by a person outside the team', async () => {
    const taskId = await asked();
    const item = await entryOf(ben, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/take`)
      .set(TEST_USER_HEADER, cy.value)
      .expect(404);
  });
});

describe('a task a person wrote in', () => {
  it('stays in their inbox as Following while someone else is the assignee', async () => {
    const taskId = await asked((task) =>
      task
        .addMessage(note(Voice.person(cy)))
        .assign(ben, TeamMembers.of([ben])),
    );

    expect(await entryOf(cy, taskId)).toMatchObject({
      standing: 'following',
      section: 'following',
      unread: false,
    });
    expect(await entryOf(ben, taskId)).toMatchObject({
      standing: 'assignee',
    });
  });

  it('refuses an answer from a member of the team who follows it', async () => {
    const taskId = await asked((task) =>
      task
        .addMessage(note(Voice.person(ben)))
        .assign(team.owner, TeamMembers.of([team.owner])),
    );
    const item = await entryOf(ben, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/answer`)
      .set(TEST_USER_HEADER, ben.value)
      .send({ body: 'From eu-west-1.' })
      .expect(409);

    expect(await assigneeOf(taskId)).toBe(team.owner.value);
  });

  it('refuses an answer from a person outside the team who follows it', async () => {
    const taskId = await asked((task) =>
      task
        .addMessage(note(Voice.person(cy)))
        .assign(ben, TeamMembers.of([ben])),
    );
    const item = await entryOf(cy, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/answer`)
      .set(TEST_USER_HEADER, cy.value)
      .send({ body: 'From eu-west-1.' })
      .expect(403);
  });

  it('stays unread for the assignee when the person who follows it opens it', async () => {
    const taskId = await asked((task) =>
      task
        .addMessage(note(Voice.person(cy)))
        .assign(ben, TeamMembers.of([ben])),
    );
    const item = await entryOf(cy, taskId);

    await served(app)
      .post(`/api/workspaces/${team.slug}/inbox/${item?.id}/read`)
      .set(TEST_USER_HEADER, cy.value)
      .expect(204);

    expect(await entryOf(ben, taskId)).toMatchObject({ unread: true });
  });
});
