import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import {
  workspace,
  workspaceMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { EventDelivery } from '@platform/events/event-delivery';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  EnrolRunnerCommand,
  RevokeRunnerCommand,
} from '@runners/application/commands/runner-fleet.commands';
import { type EnrolledRunnerDto } from '@runners/application/dto/runner.dto';
import { runner } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

let app: INestApplication;
let commands: CommandBus;
let db: DrizzleDatabase;

let enrolled: EnrolledRunnerDto;
let runId: string;
let workspaceId: string;
let slug: string;
let ownerId: string;

beforeAll(async () => {
  const fixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(fixture.createNestApplication());
  await app.init();

  commands = app.get(CommandBus);
  db = app.get<DrizzleDatabase>(DRIZZLE);

  workspaceId = `ws_${Date.now()}`;
  slug = `revocation-${Date.now()}`;
  ownerId = `user_${Date.now()}`;
  await db.insert(user).values({
    id: ownerId,
    name: 'Ada',
    email: `${ownerId}@example.com`,
  });
  await db.insert(workspace).values({
    id: workspaceId,
    name: 'Revocation',
    slug,
  });
  await db
    .insert(workspaceMember)
    .values({ workspaceId, userId: ownerId, role: 'owner' });

  enrolled = (await commands.execute<
    EnrolRunnerCommand,
    EnrolledRunnerDto | null
  >(
    new EnrolRunnerCommand(slug, ownerId, `Doomed ${Date.now()}`),
  )) as EnrolledRunnerDto;

  runId = `run_${Date.now()}`;
  await db.insert(run).values({
    id: runId,
    workspaceId,
    harness: 'dev',
    state: 'claimed',
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task:station', keep: true },
    },
    claimedBy: enrolled.runnerId,
    leaseExpiresAt: new Date(Date.now() + 5 * 60_000),
  });
});

afterAll(async () => {
  await db.delete(run).where(eq(run.id, runId));
  await db.delete(runner).where(eq(runner.id, enrolled.runnerId));
  await db.delete(workspace).where(eq(workspace.id, workspaceId));
  await db.delete(user).where(eq(user.id, ownerId));
  await app.close();
});

describe('Revoking a runner', () => {
  it('puts the run it was holding straight back on the queue', async () => {
    const before = await db.select().from(run).where(eq(run.id, runId));
    expect(before[0].state).toBe('claimed');

    await commands.execute(
      new RevokeRunnerCommand(slug, ownerId, enrolled.runnerId),
    );
    await app.get(EventDelivery).drain();

    const [after] = await db.select().from(run).where(eq(run.id, runId));

    expect(after.state).toBe('queued');
    expect(after.claimedBy).toBeNull();
    expect(after.leaseExpiresAt).toBeNull();
    expect(after.attempt).toBe(2);
  });

  it('leaves the runner revoked', async () => {
    const [after] = await db
      .select()
      .from(runner)
      .where(eq(runner.id, enrolled.runnerId));

    expect(after.revokedAt).not.toBeNull();
  });
});
