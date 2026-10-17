import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { CauseLink } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface CallbackTokenTarget {
  readonly tokenHash: TokenHash;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly hook: string;
  readonly firing: string | null;
}

interface Issued extends CallbackTokenTarget {
  readonly expiresAt: Date;
}

const LIFE_MS = 15 * 60 * 1000;

export class HookCallbackToken {
  private constructor(private readonly issued: Issued) {}

  static issueFor(target: CallbackTokenTarget, now: Date): HookCallbackToken {
    return new HookCallbackToken({
      ...target,
      expiresAt: new Date(now.getTime() + LIFE_MS),
    });
  }

  static rehydrate(issued: Issued): HookCallbackToken {
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

  get hook(): string {
    return this.issued.hook;
  }

  get firing(): string | null {
    return this.issued.firing;
  }

  get expiresAt(): Date {
    return this.issued.expiresAt;
  }

  get causeLink(): CauseLink {
    return {
      kind: 'callback',
      key: `callback:${this.issued.hook}:${this.issued.taskId.value}`,
      description: `a note by callback from the hook ${this.issued.hook}`,
    };
  }

  isValidAt(now: Date): boolean {
    return now.getTime() < this.issued.expiresAt.getTime();
  }

  coversTaskIn(workspaceId: WorkspaceId): boolean {
    return this.issued.workspaceId.equals(workspaceId);
  }

  noteIdempotencyKey(idempotencyKey: string | null): string | null {
    const { taskId, firing, hook } = this.issued;

    return idempotencyKey
      ? `callback:${taskId.value}:${firing ?? hook}:${idempotencyKey}`
      : null;
  }
}
