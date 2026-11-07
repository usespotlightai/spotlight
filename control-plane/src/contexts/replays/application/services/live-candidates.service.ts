import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class LiveCandidates {
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
    const live = await this.snapshotOf(set);

    await this.kept(live);

    return live;
  }

  async snapshotOf(set: ReplaySet): Promise<Candidate> {
    const { lineId, stationId } = set.station;
    const config = await this.work.live(lineId, stationId);

    if (!config) {
      throw new UnknownStationError(stationId.value);
    }

    const teamKey = await this.people.teamKey(set.teamId);
    const address = teamKey
      ? StationPath.of(teamKey, config.lineKey, config.block.key)
      : null;

    if (!address) {
      throw new UnknownStationError(stationId.value);
    }

    return Candidate.live({
      id: CandidateId.of(this.ids.generate()),
      station: set.station,
      address,
      block: config.block,
      fingerprint: config.fingerprint,
      hashes: config.hashes,
      scoring: config.scoring,
      at: this.clock.now(),
    });
  }

  kept(candidate: Candidate): Promise<void> {
    return this.transaction.inTransaction(() => this.candidates.add(candidate));
  }

  async release(candidate: Candidate | null): Promise<void> {
    if (!candidate) {
      return;
    }

    try {
      await this.released(candidate.id);
    } catch (error) {
      this.logger.warn(
        { candidateId: candidate.id.value, error },
        'A candidate nothing used could not be released; it stays unused',
      );
    }
  }

  released(id: CandidateId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const stored = await this.candidates.find(id);

      if (stored) {
        await this.candidates.save(stored.delete());
      }
    });
  }
}
