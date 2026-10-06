import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { CandidateWithdrawn } from '@replays/domain/events/candidate-withdrawn.event';
import { CandidateIsLiveError } from '@replays/domain/exceptions/candidate-is-live.error';
import { CandidateKeptBySpotlightError } from '@replays/domain/exceptions/candidate-kept-by-spotlight.error';
import { CandidateMovedOnError } from '@replays/domain/exceptions/candidate-moved-on.error';
import { CandidateUnderwayError } from '@replays/domain/exceptions/candidate-underway.error';
import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateKind } from '@replays/domain/value-objects/candidate-kind';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import type { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const STRONGER_MODEL_PARTS: readonly string[] = ['model', 'effort'];

interface State {
  readonly id: CandidateId;
  readonly station: ReplayedStation;
  readonly address: StationAddress;
  readonly name: CandidateName;
  readonly kind: CandidateKind;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly digests: StationDigests;
  readonly scoring: CandidateScoring;
  readonly changedFrom: StationChanges;
  readonly line: PlannedLine | null;
  readonly search: CandidateSearch | null;
  readonly reference: PlannedReference | null;
  readonly createdAt: Date;
  readonly version: number;
}

export interface CandidateSearch {
  readonly searchId: SearchId;
  readonly iteration: number;
  readonly hypothesis: Hypothesis;
}

interface Proposal {
  readonly id: CandidateId;
  readonly station: ReplayedStation;
  readonly address: StationAddress;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly digests: StationDigests;
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

  static searched(
    input: Proposal & {
      name: string;
      changedFrom: StationChanges;
      search: CandidateSearch;
    },
  ): Candidate {
    if (
      !Number.isInteger(input.search.iteration) ||
      input.search.iteration < 1
    ) {
      throw new InvalidCandidateError(
        'from a search must name its iteration, from 1',
      );
    }

    return Candidate.made(
      input,
      CandidateName.searched(input.name),
      'searched',
      input.changedFrom,
      { search: input.search },
    );
  }

  static sanity(input: Proposal & { changedFrom: StationChanges }): Candidate {
    const changed = new Set(input.changedFrom.changes.map((each) => each.part));

    if (
      changed.size === 0 ||
      [...changed].some((part) => !STRONGER_MODEL_PARTS.includes(part))
    ) {
      throw new InvalidCandidateError(
        `for a stronger model may change only the live config’s ${STRONGER_MODEL_PARTS.join(' or ')}`,
      );
    }

    return Candidate.made(
      input,
      CandidateName.sanity(input.at),
      'sanity',
      input.changedFrom,
    );
  }

  static planned(
    input: Proposal & {
      changedFrom: StationChanges;
      reference: PlannedReference;
      line: PlannedLine | null;
    },
  ): Candidate {
    return Candidate.made(
      input,
      CandidateName.planned(input.reference.label, input.at),
      'planned',
      input.changedFrom,
      { reference: input.reference, line: input.line },
    );
  }

  private static made(
    input: Proposal,
    name: CandidateName,
    kind: CandidateKind,
    changedFrom: StationChanges,
    origin: Partial<Pick<State, 'search' | 'reference' | 'line'>> = {},
  ): Candidate {
    if (input.block.key !== input.address.stationKey) {
      throw new InvalidCandidateError(
        `must keep station key ${input.address.stationKey}`,
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
      digests: input.digests,
      scoring: input.scoring,
      changedFrom,
      line: origin.line ?? null,
      search: origin.search ?? null,
      reference: origin.reference ?? null,
      createdAt: input.at,
      version: 0,
    });
  }

  static rehydrate(state: State): Candidate {
    if ((state.kind === 'searched') !== (state.search !== null)) {
      throw new InconsistentStateError(
        'candidate',
        'names the search that found it when, and only when, a search did',
      );
    }
    if (state.line !== null && state.kind !== 'planned') {
      throw new InconsistentStateError(
        'candidate',
        'plans its line’s repositories only when it checks a planned change',
      );
    }
    if ((state.kind === 'planned') !== (state.reference !== null)) {
      throw new InconsistentStateError(
        'candidate',
        'names the change it checks when, and only when, it checks one',
      );
    }

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

  get isSanity(): boolean {
    return this.state.kind === 'sanity';
  }

  get basedOn(): StationFingerprint {
    return this.state.changedFrom.from;
  }

  get isProposed(): boolean {
    return this.state.kind === 'proposed';
  }

  get search(): CandidateSearch | null {
    return this.state.search;
  }

  get reference(): PlannedReference | null {
    return this.state.reference;
  }

  get block(): StationBlock {
    return this.state.block;
  }

  get scoring(): CandidateScoring {
    return this.state.scoring;
  }

  get judge(): JudgeCriteria | null {
    return this.state.scoring.judge;
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

  get digests(): StationDigests {
    return this.state.digests;
  }

  get scoringDigest(): string {
    return this.state.digests.scoring;
  }

  get line(): PlannedLine | null {
    return this.state.line;
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
    if (!this.isProposed) {
      throw new CandidateKeptBySpotlightError(this.id.value);
    }
    if (underway) {
      throw new CandidateUnderwayError(this.id.value);
    }

    return this.gone(by);
  }

  abandoned(): Candidate {
    return this.isProposed
      ? this.gone(Attribution.spotlight(this.workspaceId))
      : new Candidate(this.state, true);
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
