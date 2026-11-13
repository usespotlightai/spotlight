import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { UnknownHostError } from '@runners/domain/exceptions/unknown-host.error';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';
import type { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import type { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { SandboxLease } from '@runners/domain/value-objects/sandbox-lease.vo';
import type { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SANDBOX_STATES = ['open', 'draining', 'gone'] as const;

export type SandboxState = (typeof SANDBOX_STATES)[number];

export type SandboxStatus = 'starting' | 'ready' | 'draining' | 'gone';

export const LIVE_SANDBOX_STATES: readonly SandboxState[] = [
  'open',
  'draining',
];

const START_WINDOW_MS = 60_000;

const GONE_RETENTION_MS = 24 * 60 * 60_000;

interface State {
  readonly id: SandboxId;
  readonly workspaceId: WorkspaceId;
  readonly key: SandboxKey | null;
  readonly hostId: HostId | null;
  readonly source: CredentialSource | null;
  readonly tokenHash: TokenHash | null;
  readonly state: SandboxState;
  readonly leases: readonly SandboxLease[];
  readonly idleSince: Date | null;
  readonly startedAt: Date;
  readonly goneAt: Date | null;
  readonly warm: WarmPart | null;
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
    host: RunnerHost;
    tokenHash: TokenHash;
    runId: RunId;
    at: Date;
  }): Sandbox {
    Sandbox.assertHostIn(input.host, input.workspaceId);

    return new Sandbox({
      id: input.id,
      workspaceId: input.workspaceId,
      key: input.key,
      hostId: input.host.id,
      source: input.host.source,
      tokenHash: input.tokenHash,
      state: 'open',
      leases: [SandboxLease.of(LeaseHolder.run(input.runId), input.at)],
      idleSince: null,
      startedAt: input.at,
      goneAt: null,
      warm: null,
      version: 0,
    });
  }

  static request(input: {
    id: SandboxId;
    workspaceId: WorkspaceId;
    key: SandboxKey;
    at: Date;
  }): Sandbox {
    return new Sandbox({
      id: input.id,
      workspaceId: input.workspaceId,
      key: input.key,
      hostId: null,
      source: null,
      tokenHash: null,
      state: 'open',
      leases: [],
      idleSince: input.at,
      startedAt: input.at,
      goneAt: null,
      warm: null,
      version: 0,
    });
  }

  static requestWarm(input: {
    id: SandboxId;
    workspaceId: WorkspaceId;
    warm: WarmPart;
    at: Date;
  }): Sandbox {
    return new Sandbox({
      id: input.id,
      workspaceId: input.workspaceId,
      key: null,
      hostId: null,
      source: null,
      tokenHash: null,
      state: 'open',
      leases: [],
      idleSince: input.at,
      startedAt: input.at,
      goneAt: null,
      warm: input.warm,
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

    if (
      (state.hostId === null) !== (state.tokenHash === null) ||
      (state.hostId === null) !== (state.source === null)
    ) {
      throw new InconsistentStateError(
        'sandbox',
        'has a host with no token or pool, or a token or pool with no host',
      );
    }

    const holdsARun = state.leases.some((each) => each.isForRun);

    if (state.hostId === null && (holdsARun || state.state === 'draining')) {
      throw new InconsistentStateError(
        'sandbox',
        `is ${state.state} or held by a run while no host started it`,
      );
    }

    if (holdsARun === (state.idleSince !== null)) {
      throw new InconsistentStateError(
        'sandbox',
        'is idle while a run holds it, or holds no run and is not idle',
      );
    }

    if (
      state.warm !== null &&
      (state.key !== null ||
        state.leases.length > 0 ||
        state.state === 'draining')
    ) {
      throw new InconsistentStateError(
        'sandbox',
        'is warm while it has a key, a lease or drains',
      );
    }

    return new Sandbox({ ...state, leases: [...state.leases] });
  }

  private static assertHostIn(host: RunnerHost, workspaceId: WorkspaceId) {
    if (!host.belongsTo(workspaceId)) {
      throw new UnknownHostError(host.id.value);
    }
  }

  static goneBefore(now: Date): Date {
    return new Date(now.getTime() - GONE_RETENTION_MS);
  }

  isExpiredAt(now: Date): boolean {
    return (
      this.state.goneAt !== null && this.state.goneAt <= Sandbox.goneBefore(now)
    );
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

  get hostId(): HostId | null {
    return this.state.hostId;
  }

  get source(): CredentialSource | null {
    return this.state.source;
  }

  get tokenHash(): TokenHash | null {
    return this.state.tokenHash;
  }

  get isPlaced(): boolean {
    return this.state.hostId !== null;
  }

  get isRequested(): boolean {
    return !this.isPlaced && this.isOpen;
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

  get warm(): WarmPart | null {
    return this.state.warm;
  }

  get isWarm(): boolean {
    return this.state.warm !== null && this.isOpen;
  }

  get lostWhileWarm(): boolean {
    return this.state.warm !== null && this.state.state === 'gone';
  }

  get isOpen(): boolean {
    return this.state.state === 'open';
  }

  get isLive(): boolean {
    return this.state.state !== 'gone';
  }

  holdsRun(runId: RunId): boolean {
    return this.isHeldBy(LeaseHolder.run(runId));
  }

  holdsEditor(holder: LeaseHolder): boolean {
    return holder.isEditor && this.isHeldBy(holder);
  }

  holdsAnEditorAt(now: Date): boolean {
    return this.state.leases.some(
      (each) => each.isForEditor && !each.expiredAt(now),
    );
  }

  get isIdle(): boolean {
    return this.state.idleSince !== null;
  }

  isOn(hostId: HostId): boolean {
    return this.state.hostId?.equals(hostId) ?? false;
  }

  isLiveOn(host: RunnerHost | null, now: Date): boolean {
    return (
      this.isLive && host !== null && this.isOn(host.id) && host.isOnlineAt(now)
    );
  }

  isReadyOn(host: RunnerHost | null, now: Date): boolean {
    return (
      this.isOpen &&
      this.isLiveOn(host, now) &&
      (host?.reportsSandbox(this.state.id) ?? false)
    );
  }

  statusOn(host: RunnerHost | null, now: Date): SandboxStatus {
    if (!this.isOpen) {
      return this.state.state === 'draining' ? 'draining' : 'gone';
    }

    return this.isReadyOn(host, now) ? 'ready' : 'starting';
  }

  takesRunOn(host: RunnerHost, now: Date): boolean {
    return this.isReadyOn(host, now) && this.isIdle && !host.isStopping;
  }

  takesFirstRunOn(host: RunnerHost, now: Date): boolean {
    return this.isWarm && this.takesRunOn(host, now);
  }

  warmFits(offer: RunnerOffer): boolean {
    return this.isRequested && (this.state.warm?.fits(offer) ?? false);
  }

  keptBy(host: RunnerHost): boolean {
    return (
      this.isOpen && this.isOn(host.id) && !(host.isStopping && this.isIdle)
    );
  }

  placeOn(host: RunnerHost, tokenHash: TokenHash, at: Date): Sandbox {
    if (this.state.warm !== null) {
      throw new InconsistentStateError(
        'sandbox',
        'is warm, and starts only on a host that offers its placement',
      );
    }

    return this.placedOn(host, tokenHash, at);
  }

  placeWarmOn(
    host: RunnerHost,
    offer: RunnerOffer,
    tokenHash: TokenHash,
    at: Date,
  ): Sandbox {
    if (!this.warmFits(offer)) {
      throw new InconsistentStateError(
        'sandbox',
        'is not a requested warm sandbox for a placement the host offers',
      );
    }

    return this.placedOn(host, tokenHash, at);
  }

  private placedOn(host: RunnerHost, tokenHash: TokenHash, at: Date): Sandbox {
    if (!this.isRequested) {
      throw new InconsistentStateError(
        'sandbox',
        `is ${this.state.state} or on a host already, and cannot start on a host`,
      );
    }

    Sandbox.assertHostIn(host, this.state.workspaceId);

    return this.with({
      hostId: host.id,
      source: host.source,
      tokenHash,
      startedAt: at,
      idleSince: at,
    });
  }

  holdRunFor(
    run: {
      runId: RunId;
      workspaceId: WorkspaceId;
      key: SandboxKey | null;
    },
    host: RunnerHost,
    at: Date,
  ): Sandbox {
    const ownsTheRun =
      run.key !== null &&
      (this.state.key?.equals(run.key) ?? false) &&
      this.state.workspaceId.equals(run.workspaceId);

    return ownsTheRun && this.takesRunOn(host, at)
      ? this.holdRun(run.runId, at)
      : this;
  }

  adoptFor(
    run: {
      runId: RunId;
      workspaceId: WorkspaceId;
      key: SandboxKey | null;
      line: LineId | null;
      lineFingerprint: string | null;
    },
    host: RunnerHost,
    at: Date,
  ): Sandbox {
    const adopts =
      run.key !== null &&
      run.line !== null &&
      run.lineFingerprint !== null &&
      (this.state.warm?.isFor(run.line, run.lineFingerprint) ?? false) &&
      this.state.workspaceId.equals(run.workspaceId) &&
      this.takesFirstRunOn(host, at);

    return adopts
      ? this.with({ key: run.key, warm: null }).holdRun(run.runId, at)
      : this;
  }

  holdRun(runId: RunId, at: Date): Sandbox {
    if (this.holdsRun(runId)) {
      return this;
    }

    if (!this.isOpen || !this.isPlaced) {
      throw new InconsistentStateError(
        'sandbox',
        `is ${this.state.state} or has no host, and cannot take run ${runId.value}`,
      );
    }

    return this.with({
      leases: [
        ...this.state.leases,
        SandboxLease.of(LeaseHolder.run(runId), at),
      ],
      idleSince: null,
    });
  }

  releaseRun(runId: RunId, at: Date): Sandbox {
    if (!this.holdsRun(runId)) {
      return this;
    }

    const holder = LeaseHolder.run(runId);
    const leases = this.state.leases.filter((each) => !each.isHeldBy(holder));

    return this.with({
      leases,
      idleSince: leases.some((each) => each.isForRun) ? null : at,
    });
  }

  retireRun(runId: RunId, at: Date): Sandbox {
    if (!this.holdsRun(runId)) {
      return this;
    }

    const released = this.releaseRun(runId, at);

    return released.leases.length === 0 ? released.drain() : released;
  }

  holdEditor(holder: LeaseHolder, at: Date): Sandbox {
    if (!holder.isEditor) {
      throw new InconsistentStateError(
        'sandbox',
        `cannot give an editor lease to a ${holder.kind}`,
      );
    }

    if (!this.isOpen || this.state.warm !== null) {
      return this;
    }

    return this.with({
      leases: [
        ...this.state.leases.filter((each) => !each.isHeldBy(holder)),
        SandboxLease.of(holder, at),
      ],
    });
  }

  releaseEditor(holder: LeaseHolder, at: Date): Sandbox {
    if (!this.holdsEditor(holder)) {
      return this;
    }

    return this.withLeases(
      this.state.leases.filter((each) => !each.isHeldBy(holder)),
      at,
    );
  }

  withoutExpiredEditors(now: Date): Sandbox {
    const leases = this.state.leases.filter((each) => !each.expiredAt(now));

    return leases.length === this.state.leases.length
      ? this
      : this.withLeases(leases, now);
  }

  static unreportedStartedBefore(now: Date): Date {
    return new Date(now.getTime() - START_WINDOW_MS);
  }

  strandedOn(host: RunnerHost | null, now: Date): Sandbox {
    const stranded = this.isLive && this.isPlaced && !this.isLiveOn(host, now);

    return stranded ? this.lost(now) : this;
  }

  replacedForRun(): Sandbox {
    return this.isOpen && this.isPlaced ? this.drain() : this;
  }

  droppedBy(hostId: HostId, at: Date): Sandbox {
    return this.isOn(hostId) ? this.lost(at) : this;
  }

  unreportedOn(host: RunnerHost, at: Date): Sandbox {
    const unreported =
      this.isOn(host.id) &&
      !host.reportsSandbox(this.state.id) &&
      this.state.startedAt <= Sandbox.unreportedStartedBefore(at);

    return unreported ? this.lost(at) : this;
  }

  lost(at: Date): Sandbox {
    return this.isLive ? this.with({ state: 'gone', goneAt: at }) : this;
  }

  drain(): Sandbox {
    if (!this.isPlaced) {
      throw new InconsistentStateError(
        'sandbox',
        'has no host to drain it; it can only be lost',
      );
    }

    return this.isOpen ? this.with({ state: 'draining', warm: null }) : this;
  }

  retireWarm(): Sandbox | 'removed' {
    if (!this.isWarm) {
      return this;
    }

    return this.isRequested ? 'removed' : this.drain();
  }

  drainedWhenPlaced(): Sandbox {
    return this.isPlaced ? this.drain() : this;
  }

  drainDue(policy: SandboxDrainPolicy, now: Date): boolean {
    const { idleSince } = this.state;

    if (!this.isOpen || idleSince === null) {
      return false;
    }

    if (this.state.warm !== null) {
      return now.getTime() - this.state.startedAt.getTime() >= policy.warmAgeMs;
    }

    const limit =
      this.state.leases.length === 0 ? policy.graceMs : policy.editorLimitMs;

    return now.getTime() - idleSince.getTime() >= limit;
  }

  drainedWhenDue(policy: SandboxDrainPolicy, now: Date): Sandbox {
    const held = this.withoutExpiredEditors(now);

    if (!held.drainDue(policy, now)) {
      return held;
    }

    return held.isPlaced ? held.drain() : held.lost(now);
  }

  private isHeldBy(holder: LeaseHolder): boolean {
    return this.state.leases.some((each) => each.isHeldBy(holder));
  }

  private withLeases(leases: readonly SandboxLease[], at: Date): Sandbox {
    const idle = !leases.some((each) => each.isForRun);

    return this.with({
      leases,
      idleSince: idle && leases.length === 0 ? at : this.state.idleSince,
    });
  }

  private with(changes: Partial<State>): Sandbox {
    return new Sandbox({ ...this.state, ...changes });
  }
}
