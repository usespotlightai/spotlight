import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { workspacePlan } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, inArray } from 'drizzle-orm';

type PlanRow = Pick<typeof workspacePlan.$inferSelect, 'plan' | 'expiresAt'>;

const termOf = (row: PlanRow): PlanTerm =>
  PlanTerm.of(Plan.rehydrate(row.plan), row.expiresAt);

@Injectable()
export class DrizzleWorkspacePlans implements WorkspacePlansPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(workspaceId: WorkspaceId): Promise<PlanTerm> {
    const [row] = await this.db
      .select()
      .from(workspacePlan)
      .where(eq(workspacePlan.workspaceId, workspaceId.value))
      .limit(1);

    return row ? termOf(row) : PlanTerm.free;
  }

  async ofEach(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<ReadonlyMap<string, PlanTerm>> {
    const ids = workspaceIds.map((each) => each.value);
    const rows =
      ids.length === 0
        ? []
        : await this.db
            .select()
            .from(workspacePlan)
            .where(inArray(workspacePlan.workspaceId, ids));
    const stored = new Map(rows.map((row) => [row.workspaceId, termOf(row)]));

    return new Map(ids.map((id) => [id, stored.get(id) ?? PlanTerm.free]));
  }
}
