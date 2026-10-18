import type {
  MemoryBenchmarkPort,
  MemoryBenchmarkView,
} from '@insights/application/ports/memory-benchmark.port';

export class NoMemoryBenchmark implements MemoryBenchmarkPort {
  async latestFor(_teamId: string): Promise<MemoryBenchmarkView | null> {
    return null;
  }
}
