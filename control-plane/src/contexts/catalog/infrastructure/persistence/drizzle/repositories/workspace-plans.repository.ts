import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspacePlan } from '@catalog/domain/value-objects/workspace-plan.vo';
import { workspacePlan } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspacePlans implements WorkspacePlanRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(workspaceId: WorkspaceId): Promise<WorkspacePlan> {
    const [row] = await this.db
      .select()
      .from(workspacePlan)
      .where(eq(workspacePlan.workspaceId, workspaceId.value))
      .limit(1);

    return row
      ? WorkspacePlan.of(Plan.of(row.plan), row.lapsesAt)
      : WorkspacePlan.free;
  }

  async forget(workspaceId: WorkspaceId): Promise<void> {
    await this.db
      .delete(workspacePlan)
      .where(eq(workspacePlan.workspaceId, workspaceId.value));
  }
}
