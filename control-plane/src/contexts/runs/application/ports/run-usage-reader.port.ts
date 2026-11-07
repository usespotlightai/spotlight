import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface SpentFacts {
  readonly amount: number;
  readonly currency: string;
}

interface TokenFacts {
  readonly input: number | null;
  readonly output: number | null;
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
}

export interface RunUsageFacts {
  readonly ms: number | null;
  readonly steps: number;
  readonly errors: number;
  readonly changedLines: number;
  readonly contextTokens: number | null;
  readonly contextWindow: number | null;
  readonly cost: SpentFacts | null;
  readonly tokens: TokenFacts;
}

export const RUN_USAGES = Symbol('RUN_USAGES');

export interface RunUsageReaderPort {
  forRuns(runIds: readonly RunId[]): Promise<Map<string, RunUsageFacts>>;
}
