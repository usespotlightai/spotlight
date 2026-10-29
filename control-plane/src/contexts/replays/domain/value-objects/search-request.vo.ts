import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class SearchRequest {
  private constructor(
    readonly candidateId: CandidateId,
    readonly name: CandidateName,
    readonly requestedBy: UserId,
  ) {}

  static of(input: {
    candidateId: CandidateId;
    name: CandidateName;
    requestedBy: UserId;
  }): SearchRequest {
    return new SearchRequest(input.candidateId, input.name, input.requestedBy);
  }

  isNamed(name: CandidateName): boolean {
    return this.name.value.toLowerCase() === name.value.toLowerCase();
  }
}
