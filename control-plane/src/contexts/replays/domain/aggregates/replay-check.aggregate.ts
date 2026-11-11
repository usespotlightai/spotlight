import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import {
  SCORING_FIELDS,
  type ScoringField,
} from '@replays/domain/services/live-scoring';
import type { CheckResult } from '@replays/domain/services/replay-check-result';
import type { BaselineStatus } from '@replays/domain/value-objects/baseline-status';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CheckedChange } from '@replays/domain/value-objects/checked-change.vo';
import type { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import {
  isValidRepeatCount,
  MAX_REPEATS,
} from '@replays/domain/value-objects/replay-repeats';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SetEntriesDigest } from '@replays/domain/value-objects/set-entries-digest.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: ReplayCheckId;
  readonly station: ReplayedStation;
  readonly stationKey: string;
  readonly setId: ReplaySetId;
  readonly setEntries: SetEntriesDigest;
  readonly attempt: number;
  readonly candidateId: CandidateId;
  readonly replayId: ReplayId;
  readonly reference: PlannedReference;
  readonly liveFingerprint: StationFingerprint;
  readonly candidateFingerprint: StationFingerprint;
  readonly liveHashes: StationHashes;
  readonly candidateHashes: StationHashes;
  readonly threshold: ReplayThreshold;
  readonly repeats: number;
  readonly scoringPinnedToLive: readonly ScoringField[];
  readonly baseline: BaselineStatus;
  readonly createdAt: Date;
  readonly version: number;
}

const REUSABLE: readonly CheckResult[] = ['running', 'passed', 'failed'];

const inScoringOrder = (fields: readonly ScoringField[]): ScoringField[] =>
  SCORING_FIELDS.filter((field) => fields.includes(field));

export class ReplayCheck extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static start(
    input: Omit<State, 'baseline' | 'version'> & { by: ChangeActor },
  ): ReplayCheck {
    const { by, ...rest } = input;
    const state: State = { ...rest, baseline: 'awaiting', version: 0 };

    if (state.candidateHashes.runsAs(state.liveHashes)) {
      throw new InvalidReplayCheckError(
        'must check a planned change, not the live config',
      );
    }
    if (!Number.isInteger(state.attempt) || state.attempt < 1) {
      throw new InvalidReplayCheckError('attempts must count from 1');
    }
    if (!isValidRepeatCount(state.repeats)) {
      throw new InvalidReplayCheckError(
        `repeats must be from 1 to ${MAX_REPEATS}`,
      );
    }

    const started = new ReplayCheck(ReplayCheck.ordered(state));

    started.record(
      new ReplayCheckStarted(
        started.id,
        started.teamId,
        ConfigurationChange.created(
          {
            resource: 'replay-check',
            id: started.id.value,
            key: started.reference.label ?? started.id.value,
          },
          by,
        ),
      ),
    );

    return started;
  }

  static nextAttemptAfter(
    earlier: readonly ReplayCheck[],
    change: CheckedChange,
  ): number {
    return (
      Math.max(
        0,
        ...earlier
          .filter((each) => each.change.equals(change))
          .map((each) => each.attempt),
      ) + 1
    );
  }

  static rehydrate(state: State): ReplayCheck {
    return new ReplayCheck(ReplayCheck.ordered(state));
  }

  private static ordered(state: State): State {
    return {
      ...state,
      scoringPinnedToLive: inScoringOrder(state.scoringPinnedToLive),
    };
  }

  get id(): ReplayCheckId {
    return this.state.id;
  }

  get station(): ReplayedStation {
    return this.state.station;
  }

  get workspaceId(): WorkspaceId {
    return this.state.station.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.station.teamId;
  }

  get stationKey(): string {
    return this.state.stationKey;
  }

  get setId(): ReplaySetId {
    return this.state.setId;
  }

  get setEntries(): SetEntriesDigest {
    return this.state.setEntries;
  }

  get attempt(): number {
    return this.state.attempt;
  }

  get candidateId(): CandidateId {
    return this.state.candidateId;
  }

  get replayId(): ReplayId {
    return this.state.replayId;
  }

  get reference(): PlannedReference {
    return this.state.reference;
  }

  get liveFingerprint(): StationFingerprint {
    return this.state.liveFingerprint;
  }

  get candidateFingerprint(): StationFingerprint {
    return this.state.candidateFingerprint;
  }

  get change(): CheckedChange {
    return CheckedChange.of(this.state.candidateHashes, this.state.liveHashes);
  }

  get liveHashes(): StationHashes {
    return this.state.liveHashes;
  }

  get candidateHashes(): StationHashes {
    return this.state.candidateHashes;
  }

  get threshold(): ReplayThreshold {
    return this.state.threshold;
  }

  get repeats(): number {
    return this.state.repeats;
  }

  get scoringPinnedToLive(): readonly ScoringField[] {
    return this.state.scoringPinnedToLive;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get version(): number {
    return this.state.version;
  }

  get baseline(): BaselineStatus {
    return this.state.baseline;
  }

  get awaitsBaseline(): boolean {
    return this.state.baseline === 'awaiting';
  }

  measuresAgainst(live: StationHashes | null): boolean {
    return live?.scoresAs(this.state.liveHashes) ?? false;
  }

  recordBaseline(): ReplayCheck {
    return this.withBaseline('found');
  }

  markBaselineUnavailable(): ReplayCheck {
    return this.withBaseline('unavailable');
  }

  private withBaseline(baseline: BaselineStatus): ReplayCheck {
    return this.state.baseline === 'awaiting' ? this.with({ baseline }) : this;
  }

  reusableFor(
    change: CheckedChange,
    setId: ReplaySetId,
    setEntries: SetEntriesDigest,
    threshold: ReplayThreshold,
    repeats: number,
    result: CheckResult,
  ): boolean {
    return (
      change.equals(this.change) &&
      setId.equals(this.state.setId) &&
      setEntries === this.state.setEntries &&
      threshold.equals(this.state.threshold) &&
      repeats === this.state.repeats &&
      REUSABLE.includes(result)
    );
  }

  delete(): ReplayCheck {
    return this.copied(this.state, true);
  }

  private with(part: Partial<State>): ReplayCheck {
    return this.copied({ ...this.state, ...part }, this.isDeleted);
  }

  private copied(state: State, isDeleted: boolean): ReplayCheck {
    const next = new ReplayCheck(state, isDeleted);

    next.inheritEvents(this);

    return next;
  }
}
