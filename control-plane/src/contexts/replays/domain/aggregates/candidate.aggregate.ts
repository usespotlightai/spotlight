import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateKind } from '@replays/domain/value-objects/candidate-kind';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import type { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { StationPath } from '@replays/domain/value-objects/station-path.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: CandidateId;
  readonly station: ReplayedStation;
  readonly address: StationPath;
  readonly name: CandidateName;
  readonly kind: CandidateKind;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly hashes: StationHashes;
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
  readonly address: StationPath;
  readonly block: StationBlock;
  readonly fingerprint: StationFingerprint;
  readonly hashes: StationHashes;
  readonly scoring: CandidateScoring;
  readonly at: Date;
}

export class Candidate extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static live(input: Proposal): Candidate {
    return Candidate.make(
      input,
      CandidateName.live(input.at),
      'live',
      StationChanges.none(input.fingerprint),
    );
  }

  static fromSearch(
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

    return Candidate.make(
      input,
      CandidateName.searched(input.name),
      'searched',
      input.changedFrom,
      { search: input.search },
    );
  }

  static oracleOf(
    live: Candidate,
    input: { id: CandidateId; at: Date },
  ): Candidate {
    if (!live.isLive) {
      throw new InvalidCandidateError(
        'handed the answer must replay the live config',
      );
    }

    return Candidate.make(
      {
        id: input.id,
        station: live.station,
        address: live.stationPath,
        block: live.block,
        fingerprint: live.fingerprint,
        hashes: live.hashes,
        scoring: live.scoring,
        at: input.at,
      },
      CandidateName.oracle(input.at),
      'oracle',
      StationChanges.none(live.fingerprint),
    );
  }

  static plan(
    input: Proposal & {
      changedFrom: StationChanges;
      reference: PlannedReference;
      line: PlannedLine | null;
    },
  ): Candidate {
    return Candidate.make(
      input,
      CandidateName.planned(input.reference.label, input.at),
      'planned',
      input.changedFrom,
      { reference: input.reference, line: input.line },
    );
  }

  private static make(
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
      hashes: input.hashes,
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

  get stationPath(): StationPath {
    return this.state.address;
  }

  get stationKey(): string {
    return this.state.address.stationKey;
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

  get isOracle(): boolean {
    return this.state.kind === 'oracle';
  }

  get basedOn(): StationFingerprint {
    return this.state.changedFrom.from;
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

  get hashes(): StationHashes {
    return this.state.hashes;
  }

  get scoringHash(): string {
    return this.state.hashes.scoring;
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

  cascadeDelete(): Candidate {
    return new Candidate(this.state, true);
  }

  isFor(stationId: string): boolean {
    return this.state.station.stationId === stationId;
  }
}
