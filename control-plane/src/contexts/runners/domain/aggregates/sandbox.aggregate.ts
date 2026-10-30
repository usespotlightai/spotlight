import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import type { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import type { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { SandboxLease } from '@runners/domain/value-objects/sandbox-lease.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type SandboxState = 'starting' | 'ready' | 'draining' | 'gone';

export const SANDBOX_STATES: readonly SandboxState[] = [
  'starting',
  'ready',
  'draining',
  'gone',
];

export const OPEN_SANDBOX_STATES: readonly SandboxState[] = [
  'starting',
  'ready',
];

export const LIVE_SANDBOX_STATES: readonly SandboxState[] = [
  ...OPEN_SANDBOX_STATES,
  'draining',
];

const START_WINDOW_MS = 60_000;

const GONE_RETENTION_MS = 24 * 60 * 60_000;

interface State {
  readonly id: SandboxId;
  readonly workspaceId: WorkspaceId;
  readonly key: SandboxKey | null;
  readonly hostId: HostId;
  readonly state: SandboxState;
  readonly leases: readonly SandboxLease[];
  readonly idleSince: Date | null;
  readonly startedAt: Date;
  readonly goneAt: Date | null;
  readonly version: number;
}

export class Sandbox extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static startForRun(input: {
    id: SandboxId;
    workspaceId: WorkspaceId;
    key: SandboxKey | null;
    hostId: HostId;
    runId: string;
    at: Date;
  }): Sandbox {
    return new Sandbox({
      id: input.id,
      workspaceId: input.workspaceId,
      key: input.key,
      hostId: input.hostId,
      state: 'starting',
      leases: [SandboxLease.forRun(input.runId, input.at)],
      idleSince: null,
      startedAt: input.at,
      goneAt: null,
      version: 0,
    });
  }

  static rehydrate(state: State): Sandbox {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'sandbox',
        `has an impossible version (${state.version})`,
      );
    }

    if ((state.state === 'gone') !== (state.goneAt !== null)) {
      throw new InconsistentStateError(
        'sandbox',
        'has a time it was gone that does not match its state',
      );
    }

    const holdsARun = state.leases.some((each) => each.kind === 'run');

    if (holdsARun === (state.idleSince !== null)) {
      throw new InconsistentStateError(
        'sandbox',
        'is idle while a run holds it, or holds no run and is not idle',
      );
    }

    return new Sandbox({ ...state, leases: [...state.leases] });
  }

  static goneBefore(now: Date): Date {
    return new Date(now.getTime() - GONE_RETENTION_MS);
  }

  get id(): SandboxId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get key(): SandboxKey | null {
    return this.state.key;
  }

  get hostId(): HostId {
    return this.state.hostId;
  }

  get current(): SandboxState {
    return this.state.state;
  }

  get leases(): readonly SandboxLease[] {
    return this.state.leases;
  }

  get idleSince(): Date | null {
    return this.state.idleSince;
  }

  get startedAt(): Date {
    return this.state.startedAt;
  }

  get goneAt(): Date | null {
    return this.state.goneAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isOpen(): boolean {
    return OPEN_SANDBOX_STATES.includes(this.state.state);
  }

  get isLive(): boolean {
    return this.state.state !== 'gone';
  }

  get mustDrain(): boolean {
    return !this.isOpen;
  }

  holdsRun(runId: string): boolean {
    return this.state.leases.some((each) => each.isHeldBy('run', runId));
  }

  releaseRun(runId: string, at: Date): Sandbox {
    if (!this.holdsRun(runId)) {
      return this;
    }

    const leases = this.state.leases.filter(
      (each) => !each.isHeldBy('run', runId),
    );

    return this.with({
      leases,
      idleSince: leases.some((each) => each.kind === 'run') ? null : at,
    });
  }

  reported(): Sandbox {
    return this.state.state === 'starting'
      ? this.with({ state: 'ready' })
      : this;
  }

  unreported(at: Date): Sandbox {
    if (!this.isLive) {
      return this;
    }

    const stillStarting =
      this.state.state === 'starting' &&
      at.getTime() - this.state.startedAt.getTime() < START_WINDOW_MS;

    return stillStarting ? this : this.lost(at);
  }

  lost(at: Date): Sandbox {
    return this.isLive ? this.with({ state: 'gone', goneAt: at }) : this;
  }

  drain(): Sandbox {
    return this.isOpen ? this.with({ state: 'draining' }) : this;
  }

  drainDue(policy: SandboxDrainPolicy, now: Date): boolean {
    const { idleSince } = this.state;

    if (!this.isOpen || idleSince === null) {
      return false;
    }

    const limit =
      this.state.leases.length === 0 ? policy.graceMs : policy.editorLimitMs;

    return now.getTime() - idleSince.getTime() >= limit;
  }

  drainedWhenDue(policy: SandboxDrainPolicy, now: Date): Sandbox {
    return this.drainDue(policy, now) ? this.drain() : this;
  }

  private with(changes: Partial<State>): Sandbox {
    return new Sandbox({ ...this.state, ...changes });
  }
}
