import type { WorkPort } from '@replays/application/ports/work.port';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplaysClearance } from '@replays/domain/services/replays-clearance';
import type { PossibleOrigin } from '@replays/domain/value-objects/config-origin.vo';

export class PossibleOrigins {
  constructor(
    private readonly candidates: CandidateRepository,
    private readonly work: WorkPort,
  ) {}

  async seenAt(
    clearance: ReplaysClearance,
    stationIds: readonly string[],
  ): Promise<readonly PossibleOrigin[]> {
    if (stationIds.length === 0) {
      return [];
    }

    const seen = (
      await this.candidates.possibleOriginsAt(clearance.teamId, stationIds)
    ).filter((each) => clearance.sees(each));

    if (seen.length === 0) {
      return [];
    }

    const standing = new Set(
      await this.work.standingAmong([
        ...new Set(seen.map((each) => each.stationId)),
      ]),
    );

    return seen.filter((each) => standing.has(each.stationId));
  }
}
