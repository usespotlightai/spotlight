import type { WorkPort } from '@replays/application/ports/work.port';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';

export interface LineStations {
  readonly lineId: string;
  readonly stationIds: readonly string[];
}

export class ForgetGoneStationOrigins {
  constructor(
    private readonly candidates: CandidateRepository,
    private readonly work: WorkPort,
  ) {}

  async lineRedefined(heard: LineStations): Promise<void> {
    const asked = [...new Set(heard.stationIds)];
    const standing = new Set(await this.work.standingAmong(asked));

    await this.candidates.removeWithdrawnAtStations(
      asked.filter((each) => !standing.has(each)),
    );
  }
}
