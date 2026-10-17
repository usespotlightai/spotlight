import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { CauseLink } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Holder {
  readonly tokenHash: TokenHash;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly hook: string;
  readonly firing: string | null;
}

interface Granted extends Holder {
  readonly expiresAt: Date;
}

const LIFE_MS = 15 * 60 * 1000;

export class HookCallbackGrant {
  private constructor(private readonly granted: Granted) {}

  static issueFor(holder: Holder, now: Date): HookCallbackGrant {
    return new HookCallbackGrant({
      ...holder,
      expiresAt: new Date(now.getTime() + LIFE_MS),
    });
  }

  static rehydrate(granted: Granted): HookCallbackGrant {
    if (Number.isNaN(granted.expiresAt.getTime())) {
      throw new InconsistentStateError(
        'hook callback grant',
        'expires at no time',
      );
    }

    return new HookCallbackGrant(granted);
  }

  static lapsedBefore(now: Date): Date {
    return now;
  }

  get tokenHash(): TokenHash {
    return this.granted.tokenHash;
  }

  get workspaceId(): WorkspaceId {
    return this.granted.workspaceId;
  }

  get taskId(): TaskId {
    return this.granted.taskId;
  }

  get hook(): string {
    return this.granted.hook;
  }

  get firing(): string | null {
    return this.granted.firing;
  }

  get expiresAt(): Date {
    return this.granted.expiresAt;
  }

  get causeLink(): CauseLink {
    return {
      kind: 'callback',
      key: `callback:${this.granted.hook}:${this.granted.taskId.value}`,
      saying: `a note by callback from the hook ${this.granted.hook}`,
    };
  }

  isValidAt(now: Date): boolean {
    return now.getTime() < this.granted.expiresAt.getTime();
  }

  coversTaskIn(workspaceId: WorkspaceId): boolean {
    return this.granted.workspaceId.equals(workspaceId);
  }

  noteHeardAs(idempotencyKey: string | null): string | null {
    const { taskId, firing, hook } = this.granted;

    return idempotencyKey
      ? `callback:${taskId.value}:${firing ?? hook}:${idempotencyKey}`
      : null;
  }
}
