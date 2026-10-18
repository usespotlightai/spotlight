export const MEMORY_BENCHMARK = Symbol('INSIGHTS_MEMORY_BENCHMARK');

export interface MemoryBenchmarkView {
  readonly ranAt: Date;
  readonly withMemories: number;
  readonly withoutMemories: number;
  readonly cases: number;
}

export interface MemoryBenchmarkPort {
  latestFor(teamId: string): Promise<MemoryBenchmarkView | null>;
}
