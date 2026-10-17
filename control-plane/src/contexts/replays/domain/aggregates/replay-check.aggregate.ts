import type {
  ReplayedStation,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import {
  SCORING_FIELDS,
  type ScoringField,
} from '@replays/domain/services/live-scoring';
import type { CheckVerdict } from '@replays/domain/services/replay-check-verdict';
import type { BaselineStanding } from '@replays/domain/value-objects/baseline-standing';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import {
  holdsRepeats,
  MAX_REPEATS,
} from '@replays/domain/value-objects/replay-repeats';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: ReplayCheckId;
  readonly station: ReplayedStation;
  readonly stationKey: string;
  readonly setId: ReplaySetId;
  readonly setEntries: string;
  readonly attempt: number;
  readonly candidateId: CandidateId;
  readonly replayId: ReplayId;
  readonly reference: PlannedReference;
  readonly liveFingerprint: StationFingerprint;
  readonly candidateFingerprint: StationFingerprint;
  readonly liveDigests: StationDigests;
  readonly candidateDigests: StationDigests;
  readonly threshold: ReplayThreshold;
  readonly repeats: number;
  readonly keptLive: readonly ScoringField[];
  readonly baseline: BaselineStanding;
  readonly createdAt: Date;
}

const REUSABLE: readonly CheckVerdict[] = ['running', 'passed', 'failed'];

const inScoringOrder = (fields: readonly ScoringField[]): ScoringField[] =>
  SCORING_FIELDS.filter((field) => fields.includes(field));

export class ReplayCheck extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isAbandoned = false,
  ) {
    super();
  }

  static start(
    input: Omit<State, 'baseline'> & { by: Attribution },
  ): ReplayCheck {
    const { by, ...rest } = input;
    const state: State = { ...rest, baseline: 'awaiting' };

    if (state.candidateDigests.runsAs(state.liveDigests)) {
      throw new InvalidReplayCheckError(
        'must check a planned change, not the live config',
      );
    }
    if (!Number.isInteger(state.attempt) || state.attempt < 1) {
      throw new InvalidReplayCheckError('attempts must count from 1');
    }
    if (!holdsRepeats(state.repeats)) {
      throw new InvalidReplayCheckError(
        `repeats must be from 1 to ${MAX_REPEATS}`,
      );
    }

    const started = ReplayCheck.rehydrate(state);

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

  static rehydrate(state: State): ReplayCheck {
    return new ReplayCheck({
      ...state,
      keptLive: inScoringOrder(state.keptLive),
    });
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

  get setEntries(): string {
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

  get liveDigests(): StationDigests {
    return this.state.liveDigests;
  }

  get candidateDigests(): StationDigests {
    return this.state.candidateDigests;
  }

  get threshold(): ReplayThreshold {
    return this.state.threshold;
  }

  get repeats(): number {
    return this.state.repeats;
  }

  get keptLive(): readonly ScoringField[] {
    return this.state.keptLive;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get baseline(): BaselineStanding {
    return this.state.baseline;
  }

  get awaitsBaseline(): boolean {
    return this.state.baseline === 'awaiting';
  }

  recordBaseline(): ReplayCheck {
    return this.baselineSettled('found');
  }

  markBaselineUnavailable(): ReplayCheck {
    return this.baselineSettled('unavailable');
  }

  private baselineSettled(baseline: BaselineStanding): ReplayCheck {
    return this.state.baseline === 'awaiting'
      ? new ReplayCheck({ ...this.state, baseline }, this.isAbandoned)
      : this;
  }

  reusableFor(
    set: ReplaySet,
    setEntries: string,
    threshold: ReplayThreshold,
    repeats: number,
    verdict: CheckVerdict,
  ): boolean {
    return (
      set.id.equals(this.state.setId) &&
      setEntries === this.state.setEntries &&
      threshold.equals(this.state.threshold) &&
      repeats === this.state.repeats &&
      REUSABLE.includes(verdict)
    );
  }

  abandon(): ReplayCheck {
    return new ReplayCheck(this.state, true);
  }
}
