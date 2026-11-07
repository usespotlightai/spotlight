import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RecordedRunUsage } from '@work/domain/entities/recorded-run-usage.entity';
import type { AttemptReading } from '@work/domain/value-objects/run-usage.vo';

export const RUN_USAGE_WRITER = Symbol('RUN_USAGE_WRITER');

export interface UsageReadings {
  readonly attempt: number;
  readonly readings: readonly AttemptReading[];
}

export interface RunUsageWriterPort {
  readingsOf(runId: RunId): Promise<UsageReadings | null>;

  record(usage: RecordedRunUsage): Promise<void>;
}
