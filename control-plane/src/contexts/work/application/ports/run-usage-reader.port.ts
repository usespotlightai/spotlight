import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { Money } from '@work/domain/value-objects/money.vo';
import type { Tokens } from '@work/domain/value-objects/tokens.vo';

export interface RunUsage {
  readonly ms: number | null;
  readonly steps: number;
  readonly errors: number;
  readonly changedLines: number;
  readonly contextTokens: number | null;
  readonly contextWindow: number | null;
  readonly cost: Money | null;
  readonly tokens: Tokens;
}

export const RUN_USAGES = Symbol('RUN_USAGES');

export interface RunUsageReaderPort {
  forRuns(runIds: readonly RunId[]): Promise<Map<string, RunUsage>>;
}
