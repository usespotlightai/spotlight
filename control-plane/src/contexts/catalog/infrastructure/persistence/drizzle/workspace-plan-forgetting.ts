import type { WorkspacePlanForgettingPort } from '@catalog/application/ports/workspace-plan-forgetting.port';
import { workspacePlan } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspacePlanForgetting
  implements WorkspacePlanForgettingPort
{
  constructor(private readonly context: DrizzleContext) {}

  async forget(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(workspacePlan)
      .where(eq(workspacePlan.workspaceId, workspaceId.value));
  }
}
