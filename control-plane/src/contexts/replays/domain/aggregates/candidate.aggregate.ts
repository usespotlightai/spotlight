import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { CandidateWithdrawn } from '@replays/domain/events/candidate-withdrawn.event';
import { CandidateIsLiveError } from '@replays/domain/exceptions/candidate-is-live.error';
import { CandidateMovedOnError } from '@replays/domain/exceptions/candidate-moved-on.error';
import { CandidateUnderwayError } from '@replays/domain/exceptions/candidate-underway.error';
import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateKind } from '@replays/domain/value-objects/candidate-kind';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: CandidateId;
  readonly station: ReplayedStation;
  readonly address: StationAddress;
  readonly name: CandidateName;
  readonly kind: CandidateKind;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly scoring: CandidateScoring;
  readonly changedFrom: StationChanges;
  readonly createdAt: Date;
  readonly version: number;
}

interface Proposal {
  readonly id: CandidateId;
  readonly station: ReplayedStation;
  readonly address: StationAddress;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly scoring: CandidateScoring;
  readonly at: Date;
}

export class Candidate extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isAbandoned = false,
  ) {
    super();
  }

  static proposed(
    input: Proposal & {
      name: CandidateName;
      changedFrom: StationChanges;
      by: Attribution;
    },
  ): Candidate {
    const proposed = Candidate.made(
      input,
      input.name,
      'proposed',
      input.changedFrom,
    );

    proposed.record(
      new CandidateProposed(
        proposed.id,
        proposed.teamId,
        ConfigurationChange.created(proposed.whatChanged, input.by),
      ),
    );

    return proposed;
  }

  static live(input: Proposal): Candidate {
    return Candidate.made(
      input,
      CandidateName.live(input.at),
      'live',
      StationChanges.none(input.fingerprint),
    );
  }

  private static made(
    input: Proposal,
    name: CandidateName,
    kind: CandidateKind,
    changedFrom: StationChanges,
  ): Candidate {
    if (input.block.key !== input.address.stationKey) {
      throw new InvalidCandidateError(
        `keeps the key of the station it is for, ${input.address.stationKey}`,
      );
    }

    return new Candidate({
      id: input.id,
      station: input.station,
      address: input.address,
      name,
      kind,
      block: input.block,
      fingerprint: input.fingerprint,
      scoring: input.scoring,
      changedFrom,
      createdAt: input.at,
      version: 0,
    });
  }

  static rehydrate(state: State): Candidate {
    return new Candidate(state);
  }

  get id(): CandidateId {
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

  get stationAddress(): StationAddress {
    return this.state.address;
  }

  get stationKey(): string {
    return this.state.address.stationKey;
  }

  get address(): CandidateAddress {
    return CandidateAddress.of(this.state.address, this.state.name);
  }

  get name(): CandidateName {
    return this.state.name;
  }

  get kind(): CandidateKind {
    return this.state.kind;
  }

  get isLive(): boolean {
    return this.state.kind === 'live';
  }

  get block(): StationBlock {
    return this.state.block;
  }

  get scoring(): CandidateScoring {
    return this.state.scoring;
  }

  get rubric(): string | null {
    return this.state.scoring.rubric;
  }

  get rubricVersion(): string | null {
    return this.state.scoring.rubricVersion;
  }

  get judges(): boolean {
    return this.state.scoring.judges;
  }

  get checksChanges(): boolean {
    return this.state.scoring.checksChanges;
  }

  get fingerprint(): StationFingerprint {
    return this.state.fingerprint;
  }

  get changedFrom(): StationChanges {
    return this.state.changedFrom;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get version(): number {
    return this.state.version;
  }

  expecting(version: number): void {
    if (version !== this.state.version) {
      throw new CandidateMovedOnError(this.id.value);
    }
  }

  withdrawn(underway: boolean, by: Attribution): Candidate {
    if (this.isLive) {
      throw new CandidateIsLiveError(this.id.value);
    }
    if (underway) {
      throw new CandidateUnderwayError(this.id.value);
    }

    return this.gone(by);
  }

  abandoned(): Candidate {
    return this.isLive
      ? new Candidate(this.state, true)
      : this.gone(Attribution.spotlight(this.workspaceId));
  }

  isFor(stationId: string): boolean {
    return this.state.station.stationId === stationId;
  }

  private gone(by: Attribution): Candidate {
    const gone = new Candidate(this.state, true);

    gone.record(
      new CandidateWithdrawn(
        this.id,
        this.teamId,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return gone;
  }

  private get whatChanged() {
    return {
      resource: 'replay-candidate' as const,
      id: this.id.value,
      key: this.address.toString(),
    };
  }
}
