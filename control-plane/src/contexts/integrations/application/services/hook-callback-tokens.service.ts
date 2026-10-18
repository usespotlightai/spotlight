import { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import type { HookCallbackTokenRepository } from '@integrations/domain/repositories/hook-callback-token.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface CallbackTarget {
  readonly workspaceId: string;
  readonly taskId: string;
  readonly hook: string;
  readonly firing: string | null;
}

export class HookCallbackTokens {
  constructor(
    private readonly callbackTokens: HookCallbackTokenRepository,
    private readonly issuer: TokenIssuer,
    private readonly clock: ClockPort,
  ) {}

  async issued(target: CallbackTarget): Promise<string> {
    const { token, hash } = this.issuer.issue();
    const now = this.clock.now();

    await this.callbackTokens.purgeExpiringBefore(
      HookCallbackToken.expiredBefore(now),
    );
    await this.callbackTokens.add(
      HookCallbackToken.issueFor(
        {
          ...target,
          workspaceId: WorkspaceId.of(target.workspaceId),
          taskId: TaskId.of(target.taskId),
          tokenHash: TokenHash.of(hash),
        },
        now,
      ),
    );

    return token;
  }

  async findByToken(token: string): Promise<HookCallbackToken | null> {
    const callbackToken = await this.callbackTokens.withToken(
      TokenHash.of(this.issuer.hash(token)),
    );

    return callbackToken?.isValidAt(this.clock.now()) ? callbackToken : null;
  }
}
