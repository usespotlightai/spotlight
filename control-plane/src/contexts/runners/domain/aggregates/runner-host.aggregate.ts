import { RunnerHostStartedServing } from '@runners/domain/events/runner-host-started-serving.event';
import { HostTakenError } from '@runners/domain/exceptions/host-taken.error';
import type { Admission } from '@runners/domain/value-objects/admission.vo';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { HostImage } from '@runners/domain/value-objects/host-image.vo';
import type { HostReport } from '@runners/domain/value-objects/host-report.vo';
import type { HostSession } from '@runners/domain/value-objects/host-session.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ANSWERS_WITHIN_MS = 90_000;

const REMEMBERED_FOR_MS = 24 * 60 * 60_000;

interface State {
  readonly id: HostId;
  readonly workspaceId: WorkspaceId;
  readonly admission: Admission;
  readonly session: HostSession;
  readonly report: HostReport;
  readonly firstSeenAt: Date;
  readonly upSince: Date;
  readonly lastSeenAt: Date;
  readonly version: number;
}

export class RunnerHost extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static present(input: {
    id: HostId;
    workspaceId: WorkspaceId;
    admission: Admission;
    session: HostSession;
    report: HostReport;
    at: Date;
  }): RunnerHost {
    return new RunnerHost({
      id: input.id,
      workspaceId: input.workspaceId,
      admission: input.admission,
      session: input.session,
      report: input.report,
      firstSeenAt: input.at,
      upSince: input.at,
      lastSeenAt: input.at,
      version: 0,
    }).noticingItStartedServing(null);
  }

  static rehydrate(state: State): RunnerHost {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'runner host',
        `has an impossible version (${state.version})`,
      );
    }
    if (state.lastSeenAt < state.firstSeenAt) {
      throw new InconsistentStateError(
        'runner host',
        'was last seen before it was first seen',
      );
    }
    if (state.upSince < state.firstSeenAt || state.upSince > state.lastSeenAt) {
      throw new InconsistentStateError(
        'runner host',
        'came up outside the time it was seen',
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

  get admission(): Admission {
    return this.state.admission;
  }

  get session(): HostSession {
    return this.state.session;
  }

  get report(): HostReport {
    return this.state.report;
  }

  get firstSeenAt(): Date {
    return this.state.firstSeenAt;
  }

  get upSince(): Date {
    return this.state.upSince;
  }

  get lastSeenAt(): Date {
    return this.state.lastSeenAt;
  }

  offering(image: RunnerImage): HostImage | null {
    return this.state.report.offering(image);
  }

  servesThrough(admission: Admission): boolean {
    return this.state.admission.equals(admission);
  }

  answersAt(now: Date): boolean {
    return RunnerHost.answering(this.state.lastSeenAt, now);
  }

  static answering(lastSeenAt: Date, now: Date): boolean {
    return lastSeenAt > RunnerHost.answeringSince(now);
  }

  static answeringSince(now: Date): Date {
    return new Date(now.getTime() - ANSWERS_WITHIN_MS);
  }

  static rememberedSince(now: Date): Date {
    return new Date(now.getTime() - REMEMBERED_FOR_MS);
  }

  get version(): number {
    return this.state.version;
  }

  reportThrough(input: {
    admission: Admission;
    workspaceId: WorkspaceId;
    session: HostSession;
    report: HostReport;
    at: Date;
  }): RunnerHost {
    if (this.servesThrough(input.admission)) {
      if (input.at <= this.state.lastSeenAt) {
        return this;
      }

      return new RunnerHost({
        ...this.state,
        session: input.session,
        report: input.report,
        upSince: this.cameUpAgain(input.session, input.at)
          ? input.at
          : this.state.upSince,
        lastSeenAt: input.at,
      }).noticingItStartedServing(this);
    }

    if (
      this.answersAt(input.at) ||
      !this.state.workspaceId.equals(input.workspaceId)
    ) {
      throw new HostTakenError(this.state.id.value);
    }

    return new RunnerHost({
      ...this.state,
      workspaceId: input.workspaceId,
      admission: input.admission,
      session: input.session,
      report: input.report,
      firstSeenAt: input.at,
      upSince: input.at,
      lastSeenAt: input.at,
    }).noticingItStartedServing(null);
  }

  private cameUpAgain(session: HostSession, at: Date): boolean {
    return !session.equals(this.state.session) || !this.answersAt(at);
  }

  get servesAHarness(): boolean {
    return this.state.report.servesAHarness;
  }

  private noticingItStartedServing(before: RunnerHost | null): RunnerHost {
    if (this.servesAHarness && !before?.servesAHarness) {
      this.record(
        new RunnerHostStartedServing(this.state.id, this.state.workspaceId),
      );
    }

    return this;
  }
}
