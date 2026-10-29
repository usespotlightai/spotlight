import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import type { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class SearchProposal {
  private constructor(
    readonly candidateId: CandidateId,
    readonly name: CandidateName,
    readonly replay: SearchReplay,
    readonly improved: boolean | null,
    readonly requestedBy: UserId | null,
  ) {}

  static of(input: {
    candidateId: CandidateId;
    name: CandidateName;
    replay: SearchReplay;
    improved: boolean | null;
    requestedBy: UserId | null;
  }): SearchProposal {
    return new SearchProposal(
      input.candidateId,
      input.name,
      input.replay,
      input.replay.hasEnded ? input.improved : null,
      input.requestedBy,
    );
  }

  isNamed(name: CandidateName): boolean {
    return this.name.value.toLowerCase() === name.value.toLowerCase();
  }

  replayEnded(
    replayId: ReplayId,
    end: ReplayStopReason,
    charge: ReplayCharge,
    improved: boolean,
  ): SearchProposal {
    const replay = this.replay.is(replayId)
      ? this.replay.endedAs(end, charge)
      : this.replay;

    if (replay === this.replay) {
      return this;
    }

    return new SearchProposal(
      this.candidateId,
      this.name,
      replay,
      this.improved ?? (replay.hasFinished && improved),
      this.requestedBy,
    );
  }

  replaySpent(replayId: ReplayId, charge: ReplayCharge): SearchProposal {
    const replay = this.replay.is(replayId)
      ? this.replay.spentAs(charge)
      : this.replay;

    return replay === this.replay
      ? this
      : new SearchProposal(
          this.candidateId,
          this.name,
          replay,
          this.improved,
          this.requestedBy,
        );
  }

  equals(other: SearchProposal): boolean {
    return (
      this.candidateId.equals(other.candidateId) &&
      this.name.equals(other.name) &&
      this.replay.equals(other.replay) &&
      this.improved === other.improved &&
      (this.requestedBy === null
        ? other.requestedBy === null
        : other.requestedBy !== null &&
          this.requestedBy.equals(other.requestedBy))
    );
  }
}
