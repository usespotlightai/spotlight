import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { eq, inArray } from 'drizzle-orm';
import * as schema from './schema';

export const deleteRunnersOf = async (
  db: DrizzleDatabase,
  workspaceId: string,
): Promise<void> => {
  await db.delete(schema.run).where(eq(schema.run.workspaceId, workspaceId));
  await db
    .delete(schema.stackCheck)
    .where(eq(schema.stackCheck.workspaceId, workspaceId));
  await db
    .delete(schema.changeStack)
    .where(eq(schema.changeStack.workspaceId, workspaceId));
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
    .delete(schema.poolToken)
    .where(
      inArray(
        schema.poolToken.poolId,
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
    .delete(schema.egressToken)
    .where(
      inArray(
        schema.egressToken.egressId,
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
