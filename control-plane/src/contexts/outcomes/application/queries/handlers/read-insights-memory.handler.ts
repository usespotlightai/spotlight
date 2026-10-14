import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsMemoryDto } from '@outcomes/application/dto/insights-memory.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { MemoryBenchmarkPort } from '@outcomes/application/ports/memory-benchmark.port';
import type { MemoryUsePort } from '@outcomes/application/ports/memory-use.port';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { ReadInsightsMemoryQuery } from '@outcomes/application/queries/read-insights-memory.query';
import {
  type TeamHistories,
  windowOf,
} from '@outcomes/application/services/team-histories.service';
import { memoryComparisonFrom } from '@outcomes/domain/services/memory-comparison';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsMemoryHandler
  implements QueryHandlerPort<ReadInsightsMemoryQuery, InsightsMemoryDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly reader: InsightsReaderPort,
    private readonly memory: MemoryUsePort,
    private readonly benchmark: MemoryBenchmarkPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadInsightsMemoryQuery): Promise<InsightsMemoryDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const compared = memoryComparisonFrom(
        await this.reader.memoryCounts({
          workspaceId: clearance.workspaceId,
          teamId: clearance.teamId,
          period,
        }),
      );
      const use = await this.memory.between(
        windowOf(clearance, period.current),
      );
      const names = await this.people.namesOf(
        use.flagged.flatMap((each) => (each.by ? [each.by] : [])),
      );
      const benchmark = await this.benchmark.latestFor(clearance.teamId.value);

      return {
        period: periodOf(period),
        truncated: false,
        standing: use.standing,
        memoriesBriefed: compared.memoriesBriefed,
        memoriesRecalled: compared.memoriesRecalled,
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
