import { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import { HookCallbackTokenVersionConflictError } from '@integrations/domain/exceptions/hook-callback-token-version-conflict.error';
import type { HookCallbackTokenRepository } from '@integrations/domain/repositories/hook-callback-token.repository';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { hookCallback } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, lt } from 'drizzle-orm';

type Row = typeof hookCallback.$inferSelect;

const toToken = (row: Row): HookCallbackToken =>
  HookCallbackToken.rehydrate({
    tokenHash: TokenHash.of(row.tokenHash),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: TaskId.of(row.taskId),
    hook: HookKey.of(row.hook),
    firing: row.firingId === null ? null : HookFiringId.of(row.firingId),
    expiresAt: row.expiresAt,
    version: row.version,
  });

@Injectable()
export class DrizzleHookCallbackTokens implements HookCallbackTokenRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(callbackToken: HookCallbackToken): Promise<void> {
    await this.context.db.insert(hookCallback).values({
      tokenHash: callbackToken.tokenHash.value,
      workspaceId: callbackToken.workspaceId.value,
      taskId: callbackToken.taskId.value,
      hook: callbackToken.hook.value,
      firingId: callbackToken.firing?.value ?? null,
      expiresAt: callbackToken.expiresAt,
    });
  }

  async withToken(hash: TokenHash): Promise<HookCallbackToken | null> {
    const [found] = await this.context.db
      .select()
      .from(hookCallback)
      .where(eq(hookCallback.tokenHash, hash.value))
      .limit(1);

    return found ? toToken(found) : null;
  }

  async expiredBefore(
    at: Date,
    max: number,
  ): Promise<readonly HookCallbackToken[]> {
    const rows = await this.context.db
      .select()
      .from(hookCallback)
      .where(lt(hookCallback.expiresAt, at))
      .limit(max);

    return rows.map(toToken);
  }

  async remove(callbackToken: HookCallbackToken): Promise<void> {
    const removed = await this.context.db
      .delete(hookCallback)
      .where(
        and(
          eq(hookCallback.tokenHash, callbackToken.tokenHash.value),
          eq(hookCallback.version, callbackToken.version),
        ),
      )
      .returning({ tokenHash: hookCallback.tokenHash });

    if (removed.length === 0) {
      throw new HookCallbackTokenVersionConflictError();
    }
  }
}
