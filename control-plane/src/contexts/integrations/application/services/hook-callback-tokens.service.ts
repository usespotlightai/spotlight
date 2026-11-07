import { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import { HookCallbackTokenVersionConflictError } from '@integrations/domain/exceptions/hook-callback-token-version-conflict.error';
import type { HookCallbackTokenRepository } from '@integrations/domain/repositories/hook-callback-token.repository';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const PURGE_BATCH = 100;

export interface CallbackTarget {
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly hook: HookKey;
  readonly firing: HookFiringId | null;
}

export class HookCallbackTokens {
  constructor(
    private readonly callbackTokens: HookCallbackTokenRepository,
    private readonly issuer: TokenIssuer,
    private readonly clock: ClockPort,
  ) {}

  async issued(target: CallbackTarget): Promise<string> {
    const { token, hash } = this.issuer.issue();

    await this.callbackTokens.add(
      HookCallbackToken.issueFor(
        { ...target, tokenHash: TokenHash.of(hash) },
        this.clock.now(),
      ),
    );

    return token;
  }

  async purgeExpired(): Promise<number> {
    const now = this.clock.now();
    const expired = await this.callbackTokens.expiredBefore(
      HookCallbackToken.expiredBefore(now),
      PURGE_BATCH,
    );

    for (const callbackToken of expired) {
      try {
        await this.callbackTokens.remove(callbackToken);
      } catch (error) {
        if (!(error instanceof HookCallbackTokenVersionConflictError)) {
          throw error;
        }
      }
    }

    return expired.length;
  }

  async findByToken(token: string): Promise<HookCallbackToken | null> {
    const callbackToken = await this.callbackTokens.withToken(
      TokenHash.of(this.issuer.hash(token)),
    );

    return callbackToken?.isValidAt(this.clock.now()) ? callbackToken : null;
  }
}
