import type {
  CallbackHolder,
  HookCallbacksPort,
} from '@integrations/application/ports/hook-callbacks.port';
import { hookCallback } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  TOKEN_MINT,
  type TokenMintPort,
} from '@shared-kernel/application/ports/token-mint.port';
import { and, eq, gt, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleHookCallbacks implements HookCallbacksPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(TOKEN_MINT) private readonly mint: TokenMintPort,
  ) {}

  async minted(holder: CallbackHolder, until: Date): Promise<string> {
    const { token, hash } = this.mint.mint();

    await this.context.db
      .delete(hookCallback)
      .where(lt(hookCallback.expiresAt, new Date()));
    await this.context.db.insert(hookCallback).values({
      tokenHash: hash,
      workspaceId: holder.workspaceId,
      taskId: holder.taskId,
      hook: holder.hook,
      firingId: holder.firing,
      expiresAt: until,
    });

    return token;
  }

  async heldBy(token: string, now: Date): Promise<CallbackHolder | null> {
    const [found] = await this.context.db
      .select()
      .from(hookCallback)
      .where(
        and(
          eq(hookCallback.tokenHash, this.mint.hash(token)),
          gt(hookCallback.expiresAt, now),
        ),
      )
      .limit(1);

    return found
      ? {
          workspaceId: found.workspaceId,
          taskId: found.taskId,
          hook: found.hook,
          firing: found.firingId,
        }
      : null;
  }
}
