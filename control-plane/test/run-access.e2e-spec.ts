import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@platform/http/routes';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RunViewing } from '@runs/application/services/run-viewing.service';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { requestedByChat, requestedBySpec } from './support/runs';
import * as schema from './support/schema';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let colleague: string;
let outsider: string;

const SPEC = {
  command: { executable: 'sh', args: [] },
  briefing: 'Plan the migration.',
  handover: { options: [], noteLimit: 0 },
  resume: {},
};

const addPerson = async (inWorkspace: boolean): Promise<string> => {
  const id = randomUUID();

  await db
    .insert(schema.user)
    .values({ id, name: 'Grace', email: `${id}@example.com` });

  if (inWorkspace) {
    await db.insert(schema.workspaceMember).values({
      workspaceId: team.workspaceId.value,
      userId: id,
      role: 'member',
    });
    await db.insert(schema.teamMember).values({
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      userId: id,
    });
  }

  return id;
};

const chatRun = async (startedBy: string): Promise<string> => {
  const chatId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.chat).values({
    id: chatId,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    startedById: startedBy,
    title: 'Plan the migration',
    harness: 'dev',
  });
  await db.insert(schema.run).values({
    ...requestedByChat(chatId, { teamId: team.teamId.value }),
    id: runId,
    workspaceId: team.workspaceId.value,
    harness: 'dev',
    state: 'queued',
    spec: SPEC,
  });

  return runId;
};

const rawRun = async (): Promise<string> => {
  const runId = randomUUID();

  await db.insert(schema.run).values({
    ...requestedBySpec(runId),
    id: runId,
    workspaceId: team.workspaceId.value,
    harness: 'dev',
    state: 'queued',
    spec: SPEC,
  });

  return runId;
};

const networkOf = (runId: string, as: string) =>
  served(app)
    .get(`/${API_PREFIX}/teams/${team.teamId.value}/runs/${runId}/network`)
    .set(TEST_USER_HEADER, as);

const teamlessNetworkOf = (runId: string, as: string) =>
  served(app)
    .get(`/${API_PREFIX}/runs/${runId}/network`)
    .set(TEST_USER_HEADER, as);

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `access-${randomUUID().slice(0, 8)}`,
  );
  colleague = await addPerson(true);
  outsider = await addPerson(false);
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('who may watch a run', () => {
  it('shows a chat run’s journal and network log only to the person who started the chat', async () => {
    const runId = await chatRun(team.owner.value);
    const runs = app.get(RunViewing);

    expect(
      (await runs.watchedBy(RunId.of(runId), team.owner))?.runId.value,
    ).toBe(runId);
    expect(
      await runs.watchedBy(RunId.of(runId), UserId.of(colleague)),
    ).toBeNull();

    await networkOf(runId, team.owner.value).expect(200);
    await networkOf(runId, colleague).expect(404);
  });

  it('shows any other listed run to the members of its workspace only', async () => {
    const runId = await rawRun();

    await teamlessNetworkOf(runId, colleague).expect(200);
    await teamlessNetworkOf(runId, outsider).expect(404);
  });
});
