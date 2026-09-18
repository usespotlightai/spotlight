import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { Money } from '@work/domain/value-objects/money.vo';

export interface RunDigest {
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: Money | null;
}

export const RUN_DIGESTS = Symbol('RUN_DIGESTS');

export interface RunDigestReaderPort {
  forRuns(runIds: readonly RunId[]): Promise<Map<string, RunDigest>>;
}
