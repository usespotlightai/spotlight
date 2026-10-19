import { HostReady } from '@runners/domain/events/host-ready.event';
import { HostInUseError } from '@runners/domain/exceptions/host-in-use.error';
import type { BootId } from '@runners/domain/value-objects/boot-id.vo';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { HostImage } from '@runners/domain/value-objects/host-image.vo';
import type { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ONLINE_WITHIN_MS = 90_000;

const HOST_RETENTION_MS = 24 * 60 * 60_000;

interface State {
  readonly id: HostId;
  readonly workspaceId: WorkspaceId;
  readonly source: CredentialSource;
  readonly bootId: BootId;
  readonly report: HostReport;
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
    at: Date;
  }): RunnerHost {
    return new RunnerHost({
      id: input.id,
      workspaceId: input.workspaceId,
      source: input.source,
      bootId: input.bootId,
      report: input.report,
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

  isOlderThan(minimum: Release): boolean {
    return (
      Release.published(this.state.report.release)?.isOlderThan(minimum) ??
      false
    );
  }

  hasSource(source: CredentialSource): boolean {
    return this.state.source.equals(source);
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

  get version(): number {
    return this.state.version;
  }

  reportThrough(input: {
    source: CredentialSource;
    workspaceId: WorkspaceId;
    bootId: BootId;
    report: HostReport;
    at: Date;
  }): RunnerHost {
    if (this.hasSource(input.source)) {
      if (input.at <= this.state.lastHeartbeatAt) {
        return this;
      }

      return new RunnerHost({
        ...this.state,
        bootId: input.bootId,
        report: input.report,
        onlineSince: this.cameOnlineAgain(input.bootId, input.at)
          ? input.at
          : this.state.onlineSince,
        lastHeartbeatAt: input.at,
      }).recordReadyOnFirstHarness(this);
    }

    if (
      this.isOnlineAt(input.at) ||
      !this.state.workspaceId.equals(input.workspaceId)
    ) {
      throw new HostInUseError(this.state.id.value);
    }

    return new RunnerHost({
      ...this.state,
      workspaceId: input.workspaceId,
      source: input.source,
      bootId: input.bootId,
      report: input.report,
      firstHeartbeatAt: input.at,
      onlineSince: input.at,
      lastHeartbeatAt: input.at,
    }).recordReadyOnFirstHarness(null);
  }

  private cameOnlineAgain(bootId: BootId, at: Date): boolean {
    return !bootId.equals(this.state.bootId) || !this.isOnlineAt(at);
  }

  get supportsAHarness(): boolean {
    return this.state.report.supportsAHarness;
  }

  private recordReadyOnFirstHarness(before: RunnerHost | null): RunnerHost {
    if (this.supportsAHarness && !before?.supportsAHarness) {
      this.record(new HostReady(this.state.id, this.state.workspaceId));
    }

    return this;
  }
}
