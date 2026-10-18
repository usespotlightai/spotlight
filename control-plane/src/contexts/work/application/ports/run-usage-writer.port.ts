import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_USAGE_WRITER = Symbol('RUN_USAGE_WRITER');

export interface RunUsageWriterPort {
  ensure(runIds: readonly RunId[]): Promise<void>;

  catchUp(): Promise<void>;
}
