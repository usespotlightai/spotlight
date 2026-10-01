import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { benchmarkShown, type MemoryBenchmark } from '@/lib/insights-memory';
import { dayShown } from '@/lib/judge';

export function MemoryBenchmarkCard({
  benchmark,
}: {
  benchmark: MemoryBenchmark | null;
}) {
  return (
    <InsightsCard
      title="Memory benchmark"
      description="The same cases run with the team’s memories and without them."
    >
      {benchmark ? (
        <p data-slot="memory-benchmark" className="text-foreground text-sm">
          {benchmarkShown(benchmark)}, run on{' '}
          {dayShown(benchmark.ranAt.slice(0, 10))}.
        </p>
      ) : (
        <p
          data-slot="memory-benchmark"
          className="text-muted-foreground text-sm"
        >
          No benchmark yet.
        </p>
      )}
    </InsightsCard>
  );
}
