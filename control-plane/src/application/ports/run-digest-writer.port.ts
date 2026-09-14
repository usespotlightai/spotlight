import type { RunId } from '@domain/value-objects/run-id.vo';

export const RUN_DIGEST_WRITER = Symbol('RUN_DIGEST_WRITER');

export interface RunDigestWriterPort {
  ensure(runIds: readonly RunId[]): Promise<void>;

  catchUp(): Promise<void>;
}
