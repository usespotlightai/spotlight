import type {
  RunAcceptancePort,
  RunTurnout,
} from '@outcomes/application/ports/run-acceptance.port';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunAcceptance implements RunAcceptancePort {
  constructor(private readonly records: RunRecordRepository) {}

  async acceptedAfter(runId: string): Promise<boolean> {
    return (await this.records.of(RunId.of(runId)))?.next?.accepts ?? false;
  }

  async turnouts(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, RunTurnout>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const records = await this.records.ofRuns(
      [...new Set(runIds)].map((each) => RunId.of(each)),
    );

    return new Map(
      records.map((record) => [record.runId.value, record.turnout] as const),
    );
  }
}
