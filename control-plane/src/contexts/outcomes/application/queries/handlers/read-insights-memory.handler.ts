import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsMemoryDto } from '@outcomes/application/dto/insights-memory.dto';
import type { MemoryBenchmarkPort } from '@outcomes/application/ports/memory-benchmark.port';
import type { MemoryUsePort } from '@outcomes/application/ports/memory-use.port';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { ReadInsightsMemoryQuery } from '@outcomes/application/queries/read-insights-memory.query';
import {
  type TeamHistories,
  windowOf,
} from '@outcomes/application/services/team-histories.service';
import { memoryComparisonOf } from '@outcomes/domain/services/memory-comparison';
import { endedWithin } from '@outcomes/domain/services/team-history';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsMemoryHandler
  implements QueryHandlerPort<ReadInsightsMemoryQuery, InsightsMemoryDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly memory: MemoryUsePort,
    private readonly benchmark: MemoryBenchmarkPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadInsightsMemoryQuery): Promise<InsightsMemoryDto> {
    try {
      const { clearance, period, history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );
      const ended = endedWithin(history.records, period.current);
      const use = await this.memory.between(
        windowOf(clearance, period.current),
        ended.map((each) => each.runId.value),
      );
      const compared = memoryComparisonOf(ended, use.runs, history.deliveries);
      const names = await this.people.namesOf(
        use.flagged.flatMap((each) => (each.by ? [each.by] : [])),
      );
      const benchmark = await this.benchmark.latestFor(clearance.teamId.value);

      return {
        period: periodOf(period),
        truncated,
        standing: use.standing,
        memoriesBriefed: use.memoriesBriefed,
        memoriesRecalled: use.memoriesRecalled,
        runsBriefed: compared.runsBriefed,
        runsRecalled: compared.runsRecalled,
        flagged: use.flagged.map((each) => ({
          ...each,
          byName: each.by ? (names.get(each.by) ?? null) : null,
          at: each.at.toISOString(),
        })),
        withMemories: compared.withMemories,
        withoutMemories: compared.withoutMemories,
        verdicts: compared.verdicts,
        benchmark: benchmark
          ? { ...benchmark, ranAt: benchmark.ranAt.toISOString() }
          : null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
