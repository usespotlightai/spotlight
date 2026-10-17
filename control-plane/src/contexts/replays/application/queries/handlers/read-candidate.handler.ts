import type { CandidateResourceDto } from '@replays/application/dto/replays.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { ReadCandidateQuery } from '@replays/application/queries/read-candidate.query';
import { candidateResourceView } from '@replays/application/services/replay-views';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadCandidateHandler
  implements QueryHandlerPort<ReadCandidateQuery, CandidateResourceDto | null>
{
  constructor(
    private readonly people: PeoplePort,
    private readonly candidates: CandidateRepository,
  ) {}

  async execute(
    query: ReadCandidateQuery,
  ): Promise<CandidateResourceDto | null> {
    try {
      const candidate = await this.candidates.find(
        CandidateId.of(query.candidateId),
      );
      const standing = candidate
        ? await this.people.standingOn(candidate.teamId.value, query.principal)
        : null;

      return candidate && standing && (candidate.isProposed || candidate.isLive)
        ? candidateResourceView(candidate)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
