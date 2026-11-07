import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';

interface State {
  readonly id: ReplayId;
  readonly setId: ReplaySetId;
  readonly candidateId: CandidateId;
  readonly scoringHash: string;
  readonly repeats: number;
  readonly ceiling: Money;
  readonly wholeSetOutsideSearch: boolean;
  readonly finished: boolean;
}

export class OracleReference {
  private constructor(private readonly state: State) {}

  static of(state: State): OracleReference {
    return new OracleReference({ ...state });
  }

  get id(): ReplayId {
    return this.state.id;
  }

  get setId(): ReplaySetId {
    return this.state.setId;
  }

  get candidateId(): CandidateId {
    return this.state.candidateId;
  }

  get scoringHash(): string {
    return this.state.scoringHash;
  }

  get repeats(): number {
    return this.state.repeats;
  }

  get ceiling(): Money {
    return this.state.ceiling;
  }

  get wholeSetOutsideSearch(): boolean {
    return this.state.wholeSetOutsideSearch;
  }

  get finished(): boolean {
    return this.state.finished;
  }
}
