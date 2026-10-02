import type { RunAcceptancePort } from '@outcomes/application/ports/run-acceptance.port';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunAcceptance implements RunAcceptancePort {
  constructor(private readonly records: RunRecordRepository) {}

  async acceptedAfter(runId: string): Promise<boolean> {
    return (await this.records.of(RunId.of(runId)))?.next?.accepts ?? false;
  }
}
