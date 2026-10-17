import type { CandidateResourceDto } from '@replays/application/dto/replays.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { ImportCandidateQuery } from '@replays/application/queries/import-candidate.query';
import { candidateResourceView } from '@replays/application/services/replay-views';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ImportCandidateHandler
  implements QueryHandlerPort<ImportCandidateQuery, CandidateResourceDto | null>
{
  constructor(
    private readonly people: PeoplePort,
    private readonly candidates: CandidateRepository,
  ) {}

  async execute(
    query: ImportCandidateQuery,
  ): Promise<CandidateResourceDto | null> {
    try {
      const address = CandidateAddress.parse(query.address);
      const teams = await this.people.readableTeams(
        query.workspaceId,
        query.principal,
      );
      const team = teams?.find((each) => each.key === address.station.teamKey);
      const candidate = team
        ? await this.candidates.proposedAt(team.teamId, address)
        : null;

      return candidate ? candidateResourceView(candidate) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
