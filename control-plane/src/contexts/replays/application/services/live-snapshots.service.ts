import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class LiveSnapshots {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly candidates: CandidateRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async taken(set: ReplaySet): Promise<Candidate> {
    const { lineId, stationId } = set.station;
    const config = await this.work.live(lineId, stationId);

    if (!config) {
      throw new UnknownStationError(stationId);
    }

    const teamKey = await this.people.teamKey(set.teamId);
    const address = teamKey
      ? StationAddress.of(teamKey, config.lineKey, config.block.key)
      : null;

    if (!address) {
      throw new UnknownStationError(stationId);
    }

    const live = Candidate.live({
      id: CandidateId.of(this.ids.generate()),
      station: set.station,
      address,
      block: config.block,
      fingerprint: config.fingerprint,
      digests: config.digests,
      scoring: config.scoring,
      at: this.clock.now(),
    });

    await this.candidates.add(live);

    return live;
  }

  async scoringOf(set: ReplaySet): Promise<string> {
    const config = await this.work.live(
      set.station.lineId,
      set.station.stationId,
    );

    if (!config) {
      throw new UnknownStationError(set.station.stationId);
    }

    return config.digests.scoring;
  }

  async release(live: Candidate | null): Promise<void> {
    if (!live) {
      return;
    }

    try {
      await this.transaction.inTransaction(() =>
        this.candidates.save(live.cascadeDelete()),
      );
    } catch (error) {
      this.logger.warn(
        { candidateId: live.id.value, error },
        'A live snapshot nothing used could not be released; it stays unused',
      );
    }
  }
}
