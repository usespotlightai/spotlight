import type { WorkspacePlanDeletionPort } from '@catalog/application/ports/workspace-plan-deletion.port';
import { workspacePlan } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspacePlanDeletion implements WorkspacePlanDeletionPort {
  constructor(private readonly context: DrizzleContext) {}

  async deleteForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(workspacePlan)
      .where(eq(workspacePlan.workspaceId, workspaceId.value));
  }
}
