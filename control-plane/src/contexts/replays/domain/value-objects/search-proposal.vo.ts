import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import type { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';

export class SearchProposal {
  private constructor(
    readonly candidateId: CandidateId,
    readonly name: CandidateName,
    readonly replay: SearchReplay,
  ) {}

  static of(input: {
    candidateId: CandidateId;
    name: CandidateName;
    replay: SearchReplay;
  }): SearchProposal {
    return new SearchProposal(input.candidateId, input.name, input.replay);
  }

  isNamed(name: CandidateName): boolean {
    return this.name.value.toLowerCase() === name.value.toLowerCase();
  }

  replayEnded(
    replayId: ReplayId,
    end: ReplayEnd,
    charge: ReplayCharge,
  ): SearchProposal {
    const replay = this.replay.is(replayId)
      ? this.replay.endedAs(end, charge)
      : this.replay;

    return replay === this.replay
      ? this
      : new SearchProposal(this.candidateId, this.name, replay);
  }

  replaySpent(replayId: ReplayId, charge: ReplayCharge): SearchProposal {
    const replay = this.replay.is(replayId)
      ? this.replay.spentAs(charge)
      : this.replay;

    return replay === this.replay
      ? this
      : new SearchProposal(this.candidateId, this.name, replay);
  }

  equals(other: SearchProposal): boolean {
    return (
      this.candidateId.equals(other.candidateId) &&
      this.name.equals(other.name) &&
      this.replay.equals(other.replay)
    );
  }
}
