import { HookCallbackGrant } from '@integrations/domain/aggregates/hook-callback-grant.aggregate';
import type { HookCallbackGrantRepository } from '@integrations/domain/repositories/hook-callback-grant.repository';
import { hookCallback } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleHookCallbackGrants implements HookCallbackGrantRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(grant: HookCallbackGrant): Promise<void> {
    await this.context.db.insert(hookCallback).values({
      tokenHash: grant.tokenHash.value,
      workspaceId: grant.workspaceId.value,
      taskId: grant.taskId.value,
      hook: grant.hook,
      firingId: grant.firing,
      expiresAt: grant.expiresAt,
    });
  }

  async withToken(hash: TokenHash): Promise<HookCallbackGrant | null> {
    const [found] = await this.context.db
      .select()
      .from(hookCallback)
      .where(eq(hookCallback.tokenHash, hash.value))
      .limit(1);

    return found
      ? HookCallbackGrant.rehydrate({
          tokenHash: TokenHash.of(found.tokenHash),
          workspaceId: WorkspaceId.of(found.workspaceId),
          taskId: TaskId.of(found.taskId),
          hook: found.hook,
          firing: found.firingId,
          expiresAt: found.expiresAt,
        })
      : null;
  }

  async forgetExpiringBefore(at: Date): Promise<void> {
    await this.context.db
      .delete(hookCallback)
      .where(lt(hookCallback.expiresAt, at));
  }
}
