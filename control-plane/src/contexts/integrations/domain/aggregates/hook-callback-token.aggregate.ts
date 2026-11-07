import { CauseLinks } from '@integrations/domain/services/cause-links';
import type { CauseLink } from '@integrations/domain/value-objects/causal-chain.vo';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface CallbackTokenTarget {
  readonly tokenHash: TokenHash;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly hook: HookKey;
  readonly firing: HookFiringId | null;
}

interface Issued extends CallbackTokenTarget {
  readonly expiresAt: Date;
  readonly version: number;
}

const LIFE_MS = 15 * 60 * 1000;

export class HookCallbackToken {
  private constructor(private readonly issued: Issued) {}

  static issueFor(target: CallbackTokenTarget, now: Date): HookCallbackToken {
    return new HookCallbackToken({
      ...target,
      expiresAt: new Date(now.getTime() + LIFE_MS),
      version: 0,
    });
  }

  static rehydrate(issued: Issued): HookCallbackToken {
    if (!Number.isInteger(issued.version) || issued.version < 1) {
      throw new InconsistentStateError(
        'hook callback token',
        `has an impossible version (${issued.version})`,
      );
    }

    if (Number.isNaN(issued.expiresAt.getTime())) {
      throw new InconsistentStateError(
        'hook callback token',
        'expires at no time',
      );
    }

    return new HookCallbackToken(issued);
  }

  static expiredBefore(now: Date): Date {
    return now;
  }

  get tokenHash(): TokenHash {
    return this.issued.tokenHash;
  }

  get workspaceId(): WorkspaceId {
    return this.issued.workspaceId;
  }

  get taskId(): TaskId {
    return this.issued.taskId;
  }

  get hook(): HookKey {
    return this.issued.hook;
  }

  get firing(): HookFiringId | null {
    return this.issued.firing;
  }

  get expiresAt(): Date {
    return this.issued.expiresAt;
  }

  get version(): number {
    return this.issued.version;
  }

  get causeLink(): CauseLink {
    return CauseLinks.callback(this.issued.hook, this.issued.taskId);
  }

  isValidAt(now: Date): boolean {
    return now.getTime() < this.issued.expiresAt.getTime();
  }

  isRemovableAt(now: Date): boolean {
    return !this.isValidAt(now);
  }

  coversTaskIn(workspaceId: WorkspaceId): boolean {
    return this.issued.workspaceId.equals(workspaceId);
  }

  noteIdempotencyKey(idempotencyKey: string | null): string | null {
    const { taskId, firing, hook } = this.issued;

    return idempotencyKey
      ? `callback:${taskId.value}:${firing?.value ?? hook.value}:${idempotencyKey}`
      : null;
  }
}
