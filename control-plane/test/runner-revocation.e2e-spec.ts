import {
  EnrolRunnerCommand,
  RevokeRunnerCommand,
} from '@application/commands/runner.commands';
import type { EnrolledRunnerDto } from '@application/dto/run.dto';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  run,
  runner,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
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

beforeAll(async () => {
  const fixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(fixture.createNestApplication());
  await app.init();

  commands = app.get(CommandBus);
  db = app.get<DrizzleDatabase>(DRIZZLE);

  workspaceId = `ws_${Date.now()}`;
  await db.insert(workspace).values({
    id: workspaceId,
    name: 'Revocation',
    slug: `revocation-${Date.now()}`,
  });

  enrolled = await commands.execute<EnrolRunnerCommand, EnrolledRunnerDto>(
    new EnrolRunnerCommand(`Doomed ${Date.now()}`),
  );

  runId = `run_${Date.now()}`;
  await db.insert(run).values({
    id: runId,
    workspaceId,
    harness: 'dev',
    state: 'claimed',
    spec: {},
    claimedBy: enrolled.runnerId,
    // Nowhere near lapsing: the point is that revoking does not wait for it.
    leaseExpiresAt: new Date(Date.now() + 5 * 60_000),
  });
});

afterAll(async () => {
  await db.delete(run).where(eq(run.id, runId));
  await db.delete(runner).where(eq(runner.id, enrolled.runnerId));
  await db.delete(workspace).where(eq(workspace.id, workspaceId));
  await app.close();
});

describe('Revoking a runner', () => {
  it('puts the run it was holding straight back on the queue', async () => {
    const before = await db.select().from(run).where(eq(run.id, runId));
    expect(before[0].state).toBe('claimed');

    await commands.execute(new RevokeRunnerCommand(enrolled.runnerId));

    const [after] = await db.select().from(run).where(eq(run.id, runId));

    expect(after.state).toBe('queued');
    expect(after.claimedBy).toBeNull();
    expect(after.leaseExpiresAt).toBeNull();
    // A fresh attempt, so the retry's journal does not collide with the first.
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
