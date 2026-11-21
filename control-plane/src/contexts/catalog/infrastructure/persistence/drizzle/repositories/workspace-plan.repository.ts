import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import { WorkspacePlanVersionConflictError } from '@catalog/domain/exceptions/workspace-plan-version-conflict.error';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { workspacePlan } from '@catalog/infrastructure/persistence/drizzle/schemas/catalog.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspacePlanRepository implements WorkspacePlanRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(workspaceId: WorkspaceId): Promise<WorkspacePlan | null> {
    const [found] = await this.context.db
      .select()
      .from(workspacePlan)
      .where(eq(workspacePlan.workspaceId, workspaceId.value))
      .limit(1);

    return found
      ? WorkspacePlan.rehydrate({
          workspaceId,
          term: PlanTerm.of(Plan.rehydrate(found.plan), found.expiresAt),
          version: found.version,
        })
      : null;
  }

  async add(added: WorkspacePlan): Promise<void> {
    await this.context.inTransaction(async () => {
      const inserted = await this.context.db
        .insert(workspacePlan)
        .values({
          workspaceId: added.workspaceId.value,
          plan: added.term.plan.value,
          expiresAt: added.term.expiresAt,
          version: added.version,
        })
        .onConflictDoNothing()
        .returning({ workspaceId: workspacePlan.workspaceId });

      if (inserted.length === 0) {
        throw new WorkspacePlanVersionConflictError(added.workspaceId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: WorkspacePlan): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(workspacePlan.workspaceId, saved.workspaceId.value),
        eq(workspacePlan.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(workspacePlan)
            .where(matching)
            .returning({ workspaceId: workspacePlan.workspaceId })
        : await this.context.db
            .update(workspacePlan)
            .set({
              plan: saved.term.plan.value,
              expiresAt: saved.term.expiresAt,
              version: saved.version + 1,
            })
            .where(matching)
            .returning({ workspaceId: workspacePlan.workspaceId });

      if (written.length === 0) {
        throw new WorkspacePlanVersionConflictError(saved.workspaceId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }
}
