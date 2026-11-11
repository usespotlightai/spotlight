import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { eq, inArray } from 'drizzle-orm';

import * as schema from './schema';

export const deleteRunsOf = async (
  db: DrizzleDatabase,
  workspaceId: string,
): Promise<void> => {
  const runs = db
    .select({ id: schema.run.id })
    .from(schema.run)
    .where(eq(schema.run.workspaceId, workspaceId));

  await db
    .update(schema.taskNote)
    .set({ runId: null })
    .where(inArray(schema.taskNote.runId, runs));
  await db
    .update(schema.chatMessage)
    .set({ runId: null })
    .where(inArray(schema.chatMessage.runId, runs));
  await db
    .delete(schema.workingCopyArchive)
    .where(inArray(schema.workingCopyArchive.grantedToRunId, runs));
  await db
    .delete(schema.startingPointHoldRun)
    .where(eq(schema.startingPointHoldRun.workspaceId, workspaceId));
  await db.delete(schema.run).where(eq(schema.run.workspaceId, workspaceId));
};

export const deleteChatsOf = async (
  db: DrizzleDatabase,
  workspaceId: string,
): Promise<void> => {
  for (let attempt = 0; ; attempt++) {
    await deleteRunsOf(db, workspaceId);

    try {
      await db
        .delete(schema.chat)
        .where(eq(schema.chat.workspaceId, workspaceId));
      return;
    } catch (error) {
      if (attempt >= 4) {
        throw error;
      }
    }
  }
};

export const deleteRunnersOf = async (
  db: DrizzleDatabase,
  workspaceId: string,
): Promise<void> => {
  await deleteRunsOf(db, workspaceId);
  await db
    .delete(schema.stackCheck)
    .where(eq(schema.stackCheck.workspaceId, workspaceId));
  await db
    .delete(schema.changeStack)
    .where(eq(schema.changeStack.workspaceId, workspaceId));
  await db
    .delete(schema.sandbox)
    .where(eq(schema.sandbox.workspaceId, workspaceId));
  await db
    .delete(schema.runnerHost)
    .where(eq(schema.runnerHost.workspaceId, workspaceId));
  await db
    .delete(schema.runnerTrust)
    .where(eq(schema.runnerTrust.workspaceId, workspaceId));
  await db
    .delete(schema.runner)
    .where(eq(schema.runner.workspaceId, workspaceId));
  await db
    .delete(schema.usedToken)
    .where(
      inArray(
        schema.usedToken.holderId,
        db
          .select({ id: schema.runnerPool.id })
          .from(schema.runnerPool)
          .where(eq(schema.runnerPool.workspaceId, workspaceId)),
      ),
    );
  await db
    .delete(schema.runnerPool)
    .where(eq(schema.runnerPool.workspaceId, workspaceId));
  await db
    .delete(schema.workspaceRunners)
    .where(eq(schema.workspaceRunners.workspaceId, workspaceId));
  await db
    .delete(schema.usedToken)
    .where(
      inArray(
        schema.usedToken.holderId,
        db
          .select({ id: schema.egress.id })
          .from(schema.egress)
          .where(eq(schema.egress.workspaceId, workspaceId)),
      ),
    );
  await db
    .delete(schema.egress)
    .where(eq(schema.egress.workspaceId, workspaceId));
};
