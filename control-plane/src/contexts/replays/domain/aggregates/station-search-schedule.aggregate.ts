import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { SearchInCooldownError } from '@replays/domain/exceptions/search-in-cooldown.error';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SearchSkip {
  readonly reason: SearchSkipReason;
  readonly at: Date;
}

interface State {
  readonly station: ReplayedStation;
  readonly setId: ReplaySetId;
  readonly lastStartedAt: Date | null;
  readonly lastSkip: SearchSkip | null;
  readonly searchedTasks: readonly TaskId[];
  readonly alertPendingSince: Date | null;
  readonly rejected: readonly StationFingerprint[];
  readonly rejectedAgainst: StationFingerprint | null;
  readonly lastRejectedAt: Date | null;
  readonly lastImprovedAt: Date | null;
  readonly checkAfter: Date;
  readonly version: number;
}

const later = (one: Date | null, other: Date | null): Date | null =>
  one && other ? (one > other ? one : other) : (one ?? other);

export class StationSearchSchedule extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static create(input: {
    station: ReplayedStation;
    setId: ReplaySetId;
    at: Date;
  }): StationSearchSchedule {
    return new StationSearchSchedule({
      station: input.station,
      setId: input.setId,
      lastStartedAt: null,
      lastSkip: null,
      searchedTasks: [],
      alertPendingSince: null,
      rejected: [],
      rejectedAgainst: null,
      lastRejectedAt: null,
      lastImprovedAt: null,
      checkAfter: input.at,
      version: 0,
    });
  }

  static rehydrate(state: State): StationSearchSchedule {
    if (
      state.searchedTasks.some((each, at) =>
        state.searchedTasks.slice(0, at).some((other) => other.equals(each)),
      )
    ) {
      throw new InconsistentStateError(
        'station search schedule',
        'records each searched task once',
      );
    }
    if (
      state.rejected.some((each, at) =>
        state.rejected.slice(0, at).some((other) => other.equals(each)),
      )
    ) {
      throw new InconsistentStateError(
        'station search schedule',
        'records each rejected config once',
      );
    }
    if (state.rejected.length > 0 !== (state.rejectedAgainst !== null)) {
      throw new InconsistentStateError(
        'station search schedule',
        'knows the live config that configs were rejected against when, and only when, one is rejected',
      );
    }

    return new StationSearchSchedule({
      ...state,
      searchedTasks: [...state.searchedTasks],
      rejected: [...state.rejected],
    });
  }

  get station(): ReplayedStation {
    return this.state.station;
  }

  get stationId(): string {
    return this.state.station.stationId;
  }

  get workspaceId(): WorkspaceId {
    return this.state.station.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.station.teamId;
  }

  get setId(): ReplaySetId {
    return this.state.setId;
  }

  get lastStartedAt(): Date | null {
    return this.state.lastStartedAt;
  }

  get lastSkip(): SearchSkip | null {
    return this.state.lastSkip;
  }

  get searchedTasks(): readonly TaskId[] {
    return this.state.searchedTasks;
  }

  get alertPendingSince(): Date | null {
    return this.state.alertPendingSince;
  }

  get rejected(): readonly StationFingerprint[] {
    return this.state.rejected;
  }

  get rejectedAgainst(): StationFingerprint | null {
    return this.state.rejectedAgainst;
  }

  get lastRejectedAt(): Date | null {
    return this.state.lastRejectedAt;
  }

  get lastImprovedAt(): Date | null {
    return this.state.lastImprovedAt;
  }

  get cooldownFrom(): Date | null {
    return later(this.state.lastStartedAt, this.state.lastRejectedAt);
  }

  hasRejected(fingerprint: StationFingerprint): boolean {
    return this.state.rejected.some((each) => each.equals(fingerprint));
  }

  get checkAfter(): Date {
    return this.state.checkAfter;
  }

  get version(): number {
    return this.state.version;
  }

  isDue(now: Date): boolean {
    return this.state.checkAfter <= now;
  }

  alerted(at: Date): StationSearchSchedule {
    return this.with({
      alertPendingSince: this.state.alertPendingSince ?? at,
      checkAfter: at < this.state.checkAfter ? at : this.state.checkAfter,
    });
  }

  configRejected(
    fingerprint: StationFingerprint,
    against: StationFingerprint,
    at: Date,
  ): StationSearchSchedule {
    const kept = this.state.rejectedAgainst?.equals(against)
      ? this.state.rejected
      : [];

    return this.with({
      rejected: kept.some((each) => each.equals(fingerprint))
        ? kept
        : [...kept, fingerprint],
      rejectedAgainst: against,
      lastRejectedAt: later(this.state.lastRejectedAt, at),
    });
  }

  configReopened(fingerprint: StationFingerprint): StationSearchSchedule {
    const rejected = this.state.rejected.filter(
      (each) => !each.equals(fingerprint),
    );

    return this.with({
      rejected,
      rejectedAgainst: rejected.length > 0 ? this.state.rejectedAgainst : null,
    });
  }

  liveChanged(live: StationFingerprint | null): StationSearchSchedule {
    const { rejectedAgainst } = this.state;

    return rejectedAgainst && !live?.equals(rejectedAgainst)
      ? this.with({ rejected: [], rejectedAgainst: null })
      : this;
  }

  improved(at: Date): StationSearchSchedule {
    return this.with({
      lastImprovedAt: later(this.state.lastImprovedAt, at),
    });
  }

  postponed(checkAfter: Date): StationSearchSchedule {
    return this.with({ checkAfter });
  }

  skipped(
    reason: SearchSkipReason,
    at: Date,
    checkAfter: Date,
  ): StationSearchSchedule {
    const repeated = this.state.lastSkip?.reason === reason;
    const skipped = this.with({
      lastSkip: repeated ? this.state.lastSkip : { reason, at },
      checkAfter,
    });

    if (!repeated) {
      const { station } = this.state;

      skipped.record(
        new StationSearchSkipped(
          station.workspaceId,
          station.teamId,
          station.lineId,
          station.stationId,
          reason,
          at,
        ),
      );
    }

    return skipped;
  }

  started(input: {
    searched: readonly TaskId[];
    inSet: readonly TaskId[];
    at: Date;
    cooldownMilliseconds: number;
  }): StationSearchSchedule {
    const { cooldownFrom } = this;
    const cooldownEnd = cooldownFrom
      ? new Date(cooldownFrom.getTime() + input.cooldownMilliseconds)
      : null;

    if (cooldownEnd && input.at < cooldownEnd) {
      throw new SearchInCooldownError(this.stationId, cooldownEnd);
    }

    const kept = [...this.state.searchedTasks, ...input.searched].filter(
      (task) => input.inSet.some((each) => each.equals(task)),
    );

    return this.with({
      lastStartedAt: input.at,
      lastSkip: null,
      alertPendingSince: null,
      searchedTasks: kept.filter(
        (task, at) => !kept.slice(0, at).some((each) => each.equals(task)),
      ),
      checkAfter: new Date(input.at.getTime() + input.cooldownMilliseconds),
    });
  }

  delete(): StationSearchSchedule {
    const deleted = new StationSearchSchedule(this.state, true);

    deleted.inheritEvents(this);

    return deleted;
  }

  private with(part: Partial<State>): StationSearchSchedule {
    const next = new StationSearchSchedule(
      { ...this.state, ...part },
      this.isDeleted,
    );

    next.inheritEvents(this);

    return next;
  }
}
