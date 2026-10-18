import { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import type { HookCallbackTokenRepository } from '@integrations/domain/repositories/hook-callback-token.repository';
import { hookCallback } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleHookCallbackTokens implements HookCallbackTokenRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(callbackToken: HookCallbackToken): Promise<void> {
    await this.context.db.insert(hookCallback).values({
      tokenHash: callbackToken.tokenHash.value,
      workspaceId: callbackToken.workspaceId.value,
      taskId: callbackToken.taskId.value,
      hook: callbackToken.hook,
      firingId: callbackToken.firing,
      expiresAt: callbackToken.expiresAt,
    });
  }

  async withToken(hash: TokenHash): Promise<HookCallbackToken | null> {
    const [found] = await this.context.db
      .select()
      .from(hookCallback)
      .where(eq(hookCallback.tokenHash, hash.value))
      .limit(1);

    return found
      ? HookCallbackToken.rehydrate({
          tokenHash: TokenHash.of(found.tokenHash),
          workspaceId: WorkspaceId.of(found.workspaceId),
          taskId: TaskId.of(found.taskId),
          hook: found.hook,
          firing: found.firingId,
          expiresAt: found.expiresAt,
        })
      : null;
  }

  async purgeExpiringBefore(at: Date): Promise<void> {
    await this.context.db
      .delete(hookCallback)
      .where(lt(hookCallback.expiresAt, at));
  }
}
