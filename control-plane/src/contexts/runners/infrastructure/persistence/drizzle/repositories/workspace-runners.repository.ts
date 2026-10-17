import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import { WorkspaceRunnersAlreadyExistError } from '@runners/domain/exceptions/workspace-runners-already-exist.error';
import { WorkspaceRunnersVersionConflictError } from '@runners/domain/exceptions/workspace-runners-version-conflict.error';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { workspaceRunners } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

const declarationOf = (declared: WorkspaceRunners) => ({
  trusts: declared.trusts.map((each) => each.value),
  pools: declared.pools.map((each) => each.value),
});

@Injectable()
export class DrizzleWorkspaceRunnersRepository
  implements WorkspaceRunnersRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: WorkspaceRunners): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(workspaceRunners).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          ...declarationOf(added),
          version: added.version,
        });
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'workspace_runners_workspace')) {
          throw new WorkspaceRunnersAlreadyExistError(added.workspaceId.value);
        }

        throw error;
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: WorkspaceRunners): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(workspaceRunners.id, saved.id.value),
        eq(workspaceRunners.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(workspaceRunners)
            .where(matching)
            .returning({ id: workspaceRunners.id })
        : await this.context.db
            .update(workspaceRunners)
            .set({ ...declarationOf(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: workspaceRunners.id });

      if (written.length === 0) {
        throw new WorkspaceRunnersVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  find(id: WorkspaceRunnersId): Promise<WorkspaceRunners | null> {
    return this.first(eq(workspaceRunners.id, id.value));
  }

  declaredIn(workspaceId: WorkspaceId): Promise<WorkspaceRunners | null> {
    return this.first(eq(workspaceRunners.workspaceId, workspaceId.value));
  }

  private async first(where: SQL): Promise<WorkspaceRunners | null> {
    const [found] = await this.context.db
      .select()
      .from(workspaceRunners)
      .where(where)
      .limit(1);

    return found
      ? WorkspaceRunners.rehydrate({
          id: WorkspaceRunnersId.of(found.id),
          workspaceId: WorkspaceId.of(found.workspaceId),
          trusts: found.trusts.map(TrustKey.of),
          pools: found.pools.map(PoolKey.of),
          version: found.version,
        })
      : null;
  }
}
