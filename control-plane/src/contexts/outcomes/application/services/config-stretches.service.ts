import type {
  ConfigStretchesPort,
  PublishedStretchBound,
  PublishedStretchStart,
} from '@outcomes/application/ports/config-stretches.port';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ConfigStretches implements ConfigStretchesPort {
  constructor(private readonly records: RunRecordRepository) {}

  async stretchStarts(
    teamId: string,
    bounds: readonly PublishedStretchBound[],
  ): Promise<readonly PublishedStretchStart[]> {
    return (await this.records.stretchStarts(TeamId.of(teamId), bounds)).map(
      (each) => ({
        runId: each.runId.value,
        stationId: each.stationId,
        fingerprint: each.fingerprint,
        changedAt: each.changedAt,
      }),
    );
  }
}
