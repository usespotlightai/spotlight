import type { PlanTermsPort } from '@catalog/application/ports/plan-terms.port';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { termOf } from '@catalog/infrastructure/persistence/drizzle/plan-term-row';
import { workspacePlan } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzlePlanTerms implements PlanTermsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(workspaceId: WorkspaceId): Promise<PlanTerm> {
    const [row] = await this.db
      .select()
      .from(workspacePlan)
      .where(eq(workspacePlan.workspaceId, workspaceId.value))
      .limit(1);

    return row ? termOf(row) : PlanTerm.free;
  }

  async ofWorkspaces(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly PlanTerm[]> {
    const rows =
      workspaceIds.length === 0
        ? []
        : await this.db
            .select()
            .from(workspacePlan)
            .where(
              inArray(
                workspacePlan.workspaceId,
                workspaceIds.map((each) => each.value),
              ),
            );
    const stored = new Map(rows.map((row) => [row.workspaceId, termOf(row)]));

    return workspaceIds.map((each) => stored.get(each.value) ?? PlanTerm.free);
  }
}
