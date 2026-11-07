import { HostBecameReady } from '@runners/domain/events/host-became-ready.event';
import { HostStoppedReportingSandbox } from '@runners/domain/events/host-stopped-reporting-sandbox.event';
import { HostInUseError } from '@runners/domain/exceptions/host-in-use.error';
import type { BootId } from '@runners/domain/value-objects/boot-id.vo';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { HostImage } from '@runners/domain/value-objects/host-image.vo';
import type { HostReport } from '@runners/domain/value-objects/host-report.vo';
import type { SandboxReport } from '@runners/domain/value-objects/sandbox-report.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ONLINE_WITHIN_MS = 90_000;

const HOST_RETENTION_MS = 24 * 60 * 60_000;

interface State {
  readonly id: HostId;
  readonly workspaceId: WorkspaceId;
  readonly source: CredentialSource;
  readonly bootId: BootId;
  readonly report: HostReport;
  readonly sandboxes: SandboxReport;
  readonly firstHeartbeatAt: Date;
  readonly onlineSince: Date;
  readonly lastHeartbeatAt: Date;
  readonly version: number;
}

export class RunnerHost extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static fromHeartbeat(input: {
    id: HostId;
    workspaceId: WorkspaceId;
    source: CredentialSource;
    bootId: BootId;
    report: HostReport;
    sandboxes: SandboxReport;
    at: Date;
  }): RunnerHost {
    return new RunnerHost({
      id: input.id,
      workspaceId: input.workspaceId,
      source: input.source,
      bootId: input.bootId,
      report: input.report,
      sandboxes: input.sandboxes,
      firstHeartbeatAt: input.at,
      onlineSince: input.at,
      lastHeartbeatAt: input.at,
      version: 0,
    }).recordReadyOnFirstHarness(null);
  }

  static rehydrate(state: State): RunnerHost {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'runner host',
        `has an impossible version (${state.version})`,
      );
    }
    if (state.lastHeartbeatAt < state.firstHeartbeatAt) {
      throw new InconsistentStateError(
        'runner host',
        'has its last heartbeat before its first heartbeat',
      );
    }
    if (
      state.onlineSince < state.firstHeartbeatAt ||
      state.onlineSince > state.lastHeartbeatAt
    ) {
      throw new InconsistentStateError(
        'runner host',
        'came online outside the time of its heartbeats',
      );
    }

    return new RunnerHost(state);
  }

  get id(): HostId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get source(): CredentialSource {
    return this.state.source;
  }

  get bootId(): BootId {
    return this.state.bootId;
  }

  get report(): HostReport {
    return this.state.report;
  }

  get sandboxes(): SandboxReport {
    return this.state.sandboxes;
  }

  reportsSandbox(id: SandboxId): boolean {
    return this.state.sandboxes.includes(id);
  }

  get isStopping(): boolean {
    return this.state.sandboxes.stopping;
  }

  get firstHeartbeatAt(): Date {
    return this.state.firstHeartbeatAt;
  }

  get onlineSince(): Date {
    return this.state.onlineSince;
  }

  get lastHeartbeatAt(): Date {
    return this.state.lastHeartbeatAt;
  }

  supportedImage(image: RunnerImage): HostImage | null {
    return this.state.report.supportedImage(image);
  }

  get isOutdated(): boolean {
    return this.state.report.release.isOutdated;
  }

  hasSource(source: CredentialSource): boolean {
    return this.state.source.equals(source);
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.state.workspaceId.equals(workspaceId);
  }

  admits(source: CredentialSource, workspaceId: WorkspaceId): boolean {
    return this.belongsTo(workspaceId) && this.hasSource(source);
  }

  isOnlineAt(now: Date): boolean {
    return RunnerHost.isOnline(this.state.lastHeartbeatAt, now);
  }

  static isOnline(lastHeartbeatAt: Date, now: Date): boolean {
    return lastHeartbeatAt > RunnerHost.onlineCutoff(now);
  }

  static onlineCutoff(now: Date): Date {
    return new Date(now.getTime() - ONLINE_WITHIN_MS);
  }

  static staleBefore(now: Date): Date {
    return new Date(now.getTime() - HOST_RETENTION_MS);
  }

  isStaleAt(now: Date): boolean {
    return this.state.lastHeartbeatAt <= RunnerHost.staleBefore(now);
  }

  get version(): number {
    return this.state.version;
  }

  reportThrough(input: {
    source: CredentialSource;
    workspaceId: WorkspaceId;
    bootId: BootId;
    report: HostReport;
    sandboxes: SandboxReport;
    at: Date;
  }): RunnerHost {
    if (this.hasSource(input.source)) {
      if (input.at <= this.state.lastHeartbeatAt) {
        return this;
      }

      return this.with({
        bootId: input.bootId,
        report: input.report,
        sandboxes: input.sandboxes,
        onlineSince: this.cameOnlineAgain(input.bootId, input.at)
          ? input.at
          : this.state.onlineSince,
        lastHeartbeatAt: input.at,
      })
        .recordReadyOnFirstHarness(this)
        .recordSandboxesDroppedSince(this, input.at);
    }

    if (
      this.isOnlineAt(input.at) ||
      !this.state.workspaceId.equals(input.workspaceId)
    ) {
      throw new HostInUseError(this.state.id.value);
    }

    return this.with({
      workspaceId: input.workspaceId,
      source: input.source,
      bootId: input.bootId,
      report: input.report,
      sandboxes: input.sandboxes,
      firstHeartbeatAt: input.at,
      onlineSince: input.at,
      lastHeartbeatAt: input.at,
    })
      .recordReadyOnFirstHarness(null)
      .recordSandboxesDroppedSince(this, input.at);
  }

  private with(changes: Partial<State>): RunnerHost {
    const next = new RunnerHost({ ...this.state, ...changes });
    next.inheritEvents(this);

    return next;
  }

  private cameOnlineAgain(bootId: BootId, at: Date): boolean {
    return !bootId.equals(this.state.bootId) || !this.isOnlineAt(at);
  }

  get supportsAHarness(): boolean {
    return this.state.report.supportsAHarness;
  }

  private recordReadyOnFirstHarness(before: RunnerHost | null): RunnerHost {
    if (this.supportsAHarness && !before?.supportsAHarness) {
      this.record(new HostBecameReady(this.state.id, this.state.workspaceId));
    }

    return this;
  }

  private recordSandboxesDroppedSince(
    before: RunnerHost,
    at: Date,
  ): RunnerHost {
    for (const dropped of before.sandboxes.droppedIn(this.state.sandboxes)) {
      this.record(
        new HostStoppedReportingSandbox(
          this.state.id,
          before.workspaceId,
          dropped,
          at,
        ),
      );
    }

    return this;
  }
}
