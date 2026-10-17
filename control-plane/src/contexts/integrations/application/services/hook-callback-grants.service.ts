import { HookCallbackGrant } from '@integrations/domain/aggregates/hook-callback-grant.aggregate';
import type { HookCallbackGrantRepository } from '@integrations/domain/repositories/hook-callback-grant.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface CallbackHolder {
  readonly workspaceId: string;
  readonly taskId: string;
  readonly hook: string;
  readonly firing: string | null;
}

export class HookCallbackGrants {
  constructor(
    private readonly grants: HookCallbackGrantRepository,
    private readonly mint: TokenMintPort,
    private readonly clock: ClockPort,
  ) {}

  async issued(holder: CallbackHolder): Promise<string> {
    const { token, hash } = this.mint.mint();
    const now = this.clock.now();

    await this.grants.forgetExpiringBefore(
      HookCallbackGrant.expiredBefore(now),
    );
    await this.grants.add(
      HookCallbackGrant.issueFor(
        {
          ...holder,
          workspaceId: WorkspaceId.of(holder.workspaceId),
          taskId: TaskId.of(holder.taskId),
          tokenHash: TokenHash.of(hash),
        },
        now,
      ),
    );

    return token;
  }

  async findByToken(token: string): Promise<HookCallbackGrant | null> {
    const grant = await this.grants.withToken(
      TokenHash.of(this.mint.hash(token)),
    );

    return grant?.isValidAt(this.clock.now()) ? grant : null;
  }
}
