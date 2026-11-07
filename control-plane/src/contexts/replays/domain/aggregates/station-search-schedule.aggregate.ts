import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { RequestLimitReachedError } from '@replays/domain/exceptions/request-limit-reached.error';
import { SearchInCooldownError } from '@replays/domain/exceptions/search-in-cooldown.error';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REQUESTS_PER_DAY = 3;

export interface RequestTally {
  readonly day: string;
  readonly counted: readonly CandidateId[];
}

const dayOf = (at: Date): string => at.toISOString().slice(0, 10);

export interface SearchSkip {
  readonly reason: SearchSkipReason;
  readonly at: Date;
}

export interface ReplacedSchedule {
  readonly lastStartedAt: Date | null;
  readonly lastSkip: SearchSkip | null;
  readonly alertPendingSince: Date | null;
  readonly checkAfter: Date;
  readonly startedCheckAfter: Date;
}

export const PENDING_STEP_LEASE_MS = 10 * 60 * 1000;

export interface SearchStepKey {
  readonly kind: 'start' | 'join';
  readonly searchId: SearchId;
  readonly request: CandidateId | null;
}

export interface PendingSearchStep extends SearchStepKey {
  readonly at: Date;
  readonly candidates: readonly CandidateId[];
  readonly addedTasks: readonly TaskId[];
  readonly replaced: ReplacedSchedule | null;
}

const isStep = (step: SearchStepKey, key: SearchStepKey): boolean =>
  step.kind === key.kind &&
  step.searchId.equals(key.searchId) &&
  (key.kind === 'start' ||
    (key.request !== null && (step.request?.equals(key.request) ?? false)));

const sameTime = (one: Date | null, other: Date | null): boolean =>
  one?.getTime() === other?.getTime();

const earlier = (one: Date | null, other: Date | null): Date | null =>
  one && other ? (one < other ? one : other) : (one ?? other);

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
  readonly requests: RequestTally | null;
  readonly pendingSteps: readonly PendingSearchStep[];
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
      requests: null,
      pendingSteps: [],
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

    if (
      state.requests &&
      (state.requests.counted.length < 1 ||
        state.requests.counted.length > REQUESTS_PER_DAY)
    ) {
      throw new InconsistentStateError(
        'station search schedule',
        `counts from 1 to ${REQUESTS_PER_DAY} requests a day`,
      );
    }
    if (
      state.requests?.counted.some((each, at, all) =>
        all.slice(0, at).some((other) => other.equals(each)),
      )
    ) {
      throw new InconsistentStateError(
        'station search schedule',
        'counts each request once',
      );
    }
    if (
      state.pendingSteps.some(
        (each, at, all) =>
          (each.kind === 'join' &&
            (each.request === null ||
              each.replaced !== null ||
              each.addedTasks.length > 0)) ||
          all.slice(0, at).some((other) => isStep(other, each)),
      )
    ) {
      throw new InconsistentStateError(
        'station search schedule',
        'records each pending start or join once',
      );
    }

    return new StationSearchSchedule({
      ...state,
      searchedTasks: [...state.searchedTasks],
      rejected: [...state.rejected],
      pendingSteps: [...state.pendingSteps],
    });
  }

  get station(): ReplayedStation {
    return this.state.station;
  }

  get stationId(): StationId {
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

  get requests(): RequestTally | null {
    return this.state.requests;
  }

  takesRequestOn(at: Date): boolean {
    const { requests } = this.state;

    return (
      requests === null ||
      requests.day !== dayOf(at) ||
      requests.counted.length < REQUESTS_PER_DAY
    );
  }

  get pendingSteps(): readonly PendingSearchStep[] {
    return this.state.pendingSteps;
  }

  get stepsPendingSince(): Date | null {
    return this.state.pendingSteps.reduce<Date | null>(
      (since, each) => earlier(since, each.at),
      null,
    );
  }

  requested(input: {
    searchId: SearchId;
    request: CandidateId;
    at: Date;
  }): StationSearchSchedule {
    return this.counted(input.request, input.at).stepPending({
      kind: 'join',
      searchId: input.searchId,
      at: input.at,
      request: input.request,
      candidates: [input.request],
      addedTasks: [],
      replaced: null,
    });
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
    searchId: SearchId;
    request: CandidateId | null;
    candidates: readonly CandidateId[];
    searched: readonly TaskId[];
    inSet: readonly TaskId[];
    at: Date;
    cooldownMilliseconds: number;
  }): StationSearchSchedule {
    const { cooldownFrom } = this;
    const cooldownEnd = cooldownFrom
      ? new Date(cooldownFrom.getTime() + input.cooldownMilliseconds)
      : null;

    const kept = [...this.state.searchedTasks, ...input.searched].filter(
      (task) => input.inSet.some((each) => each.equals(task)),
    );
    const searchedTasks = kept.filter(
      (task, at) => !kept.slice(0, at).some((each) => each.equals(task)),
    );
    const addedTasks = searchedTasks.filter(
      (task) => !this.state.searchedTasks.some((each) => each.equals(task)),
    );
    const step = {
      kind: 'start' as const,
      searchId: input.searchId,
      at: input.at,
      request: input.request,
      candidates: [...input.candidates],
      addedTasks,
    };

    if (input.request) {
      return this.counted(input.request, input.at)
        .with({ searchedTasks })
        .stepPending({ ...step, replaced: null });
    }
    if (cooldownEnd && input.at < cooldownEnd) {
      throw new SearchInCooldownError(this.stationId, cooldownEnd);
    }

    const checkAfter = new Date(
      input.at.getTime() + input.cooldownMilliseconds,
    );

    return this.with({
      lastStartedAt: input.at,
      lastSkip: null,
      alertPendingSince: null,
      searchedTasks,
      checkAfter,
    }).stepPending({
      ...step,
      replaced: {
        lastStartedAt: this.state.lastStartedAt,
        lastSkip: this.state.lastSkip,
        alertPendingSince: this.state.alertPendingSince,
        checkAfter: this.state.checkAfter,
        startedCheckAfter: checkAfter,
      },
    });
  }

  stepConfirmed(key: SearchStepKey): StationSearchSchedule {
    return this.resolved(key);
  }

  stepWithdrawn(key: SearchStepKey): StationSearchSchedule {
    const step = this.stepOf(key);

    if (!step) {
      return this;
    }

    const { replaced } = step;
    const searchedTasks = this.state.searchedTasks.filter(
      (task) => !step.addedTasks.some((each) => each.equals(task)),
    );
    const withdrawn = this.resolved(key)
      .uncounted(step.request)
      .with({ searchedTasks });

    return replaced
      ? withdrawn.with({
          lastStartedAt: sameTime(this.state.lastStartedAt, step.at)
            ? replaced.lastStartedAt
            : this.state.lastStartedAt,
          lastSkip: this.state.lastSkip ?? replaced.lastSkip,
          alertPendingSince: earlier(
            this.state.alertPendingSince,
            replaced.alertPendingSince,
          ),
          checkAfter: sameTime(
            this.state.checkAfter,
            replaced.startedCheckAfter,
          )
            ? replaced.checkAfter
            : this.state.checkAfter,
        })
      : withdrawn;
  }

  delete(): StationSearchSchedule {
    const deleted = new StationSearchSchedule(this.state, true);

    deleted.inheritEvents(this);

    return deleted;
  }

  private counted(request: CandidateId, at: Date): StationSearchSchedule {
    if (!this.takesRequestOn(at)) {
      throw new RequestLimitReachedError(this.stationId, REQUESTS_PER_DAY);
    }

    const day = dayOf(at);
    const { requests } = this.state;

    return this.with({
      requests: {
        day,
        counted: [...(requests?.day === day ? requests.counted : []), request],
      },
    });
  }

  private uncounted(request: CandidateId | null): StationSearchSchedule {
    const { requests } = this.state;

    if (!request || !requests) {
      return this;
    }

    const counted = requests.counted.filter((each) => !each.equals(request));

    return this.with({
      requests: counted.length > 0 ? { day: requests.day, counted } : null,
    });
  }

  private stepOf(key: SearchStepKey): PendingSearchStep | null {
    return this.state.pendingSteps.find((each) => isStep(each, key)) ?? null;
  }

  private stepPending(step: PendingSearchStep): StationSearchSchedule {
    return this.with({ pendingSteps: [...this.state.pendingSteps, step] });
  }

  private resolved(key: SearchStepKey): StationSearchSchedule {
    return this.stepOf(key)
      ? this.with({
          pendingSteps: this.state.pendingSteps.filter(
            (each) => !isStep(each, key),
          ),
        })
      : this;
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
