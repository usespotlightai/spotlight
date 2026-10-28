import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ReplayFactsPort } from '@work/application/ports/replay-facts.port';
import type {
  RecentRun,
  ReplayableRunsPort,
  RunSummary,
} from '@work/application/ports/replayable-runs.port';
import type { RunUsageReaderPort } from '@work/application/ports/run-usage-reader.port';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import { replayBlockOf } from '@work/domain/services/replay-block';

export class ReplayableRuns implements ReplayableRunsPort {
  constructor(
    private readonly facts: ReplayFactsPort,
    private readonly stationRuns: StationRunReaderPort,
    private readonly usages: RunUsageReaderPort,
  ) {}

  async summaries(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly RunSummary[]> {
    const known = await this.facts.of(workspaceId, runIds);

    return [...new Set(runIds)].map((runId) => {
      const facts = known.get(runId) ?? null;
      const block = replayBlockOf(facts);
      const placed = facts?.inWorkspace ? facts : null;

      return {
        runId,
        taskId: placed?.taskId ?? null,
        stationId: placed?.stationId ?? null,
        unreplayableReason: block?.unreplayableReason ?? null,
        reason: block?.reason ?? null,
        title: placed?.title ?? null,
        state: placed?.state ?? null,
        endedAt: placed?.endedAt ?? null,
        origin: placed?.origin ?? null,
      };
    });
  }

  async durations(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const usages = await this.usages.forRuns(
      [...new Set(runIds)].map((each) => RunId.of(each)),
    );

    return new Map(
      [...usages].flatMap(([runId, usage]) =>
        usage.ms === null ? [] : [[runId, usage.ms] as const],
      ),
    );
  }

  async recentAt(
    workspaceId: string,
    stationId: string,
    max: number,
  ): Promise<readonly RecentRun[]> {
    const ended = await this.stationRuns.endedAt(stationId, {
      fingerprint: null,
      since: null,
      until: null,
      max,
      excluding: [],
    });
    const checked = new Map(
      (
        await this.summaries(
          workspaceId,
          ended.map((each) => each.runId),
        )
      ).map((each) => [each.runId, each]),
    );

    return ended.flatMap((each) => {
      const replayable = checked.get(each.runId);

      return replayable && replayable.unreplayableReason !== 'unknown-run'
        ? [
            {
              ...replayable,
              title: each.title,
              state: each.state,
              endedAt: each.endedAt,
            },
          ]
        : [];
    });
  }
}
