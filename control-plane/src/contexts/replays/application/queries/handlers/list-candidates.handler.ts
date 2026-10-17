import type { CandidateResourceDto } from '@replays/application/dto/replays.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { ListCandidatesQuery } from '@replays/application/queries/list-candidates.query';
import { candidateResourceView } from '@replays/application/services/replay-views';
import { InvalidStationAddressError } from '@replays/domain/exceptions/invalid-station-address.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListCandidatesHandler
  implements
    QueryHandlerPort<
      ListCandidatesQuery,
      readonly CandidateResourceDto[] | null
    >
{
  constructor(
    private readonly people: PeoplePort,
    private readonly candidates: CandidateRepository,
  ) {}

  async execute(
    query: ListCandidatesQuery,
  ): Promise<readonly CandidateResourceDto[] | null> {
    try {
      const at = query.station === null ? null : this.stationAt(query.station);
      const teams = await this.people.readableTeams(
        query.workspaceId,
        query.principal,
      );

      if (!teams) {
        return null;
      }

      const held = await this.candidates.ofTeams(
        teams
          .filter((each) => !at || each.key === at.teamKey)
          .map((each) => each.teamId),
      );

      return held
        .filter(
          (each) => each.isProposed && (!at || each.stationAddress.equals(at)),
        )
        .map(candidateResourceView);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private stationAt(held: string): StationAddress {
    const at = StationAddress.parsed(held);

    if (!at) {
      throw new InvalidStationAddressError(held);
    }

    return at;
  }
}
