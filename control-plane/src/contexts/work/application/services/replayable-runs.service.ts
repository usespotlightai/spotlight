import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { UnreplayableReasonCode } from '@work/application/contracts/unreplayable-reason.contract';
import type { ReplayFactsPort } from '@work/application/ports/replay-facts.port';
import type {
  RecentRun,
  Replayability,
  ReplayableRunsPort,
  RunSummary,
} from '@work/application/ports/replayable-runs.port';
import type { RunUsageReaderPort } from '@work/application/ports/run-usage-reader.port';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import type { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { replayBlockOf } from '@work/domain/services/replay-block';

export class ReplayableRuns implements ReplayableRunsPort {
  constructor(
    private readonly facts: ReplayFactsPort,
    private readonly runs: RunRepository,
    private readonly lines: LineRepository,
    private readonly dispatch: DispatchReplay,
    private readonly stationRuns: StationRunReaderPort,
    private readonly usages: RunUsageReaderPort,
    private readonly ids: IdGeneratorPort,
    private readonly logger: LoggerPort,
  ) {}

  async check(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly Replayability[]> {
    const workspace = WorkspaceId.of(workspaceId);
    const checked: Replayability[] = [];

    for (const runId of [...new Set(runIds)]) {
      checked.push(await this.checked(workspace, runId));
    }

    return checked;
  }

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

  private async checked(
    workspaceId: WorkspaceId,
    runId: string,
  ): Promise<Replayability> {
    const run = await this.runs.findById(RunId.of(runId));

    if (!run?.workspaceId.equals(workspaceId)) {
      return unreplayable(
        runId,
        null,
        null,
        'unknown-run',
        'The run is not in this workspace.',
      );
    }

    const taskId = run.taskId?.value ?? null;
    const stationId = run.stationId?.value ?? null;
    const line = run.stationId
      ? await this.lines.findByStation(run.stationId)
      : null;

    if (!line) {
      return unreplayable(
        runId,
        taskId,
        stationId,
        'not-at-the-station',
        'No line has the station that it worked at.',
      );
    }

    try {
      await this.dispatch.planned(run, line, RunId.of(this.ids.generate()));
    } catch (error) {
      if (error instanceof UnreplayableRunError) {
        return unreplayable(
          runId,
          taskId,
          stationId,
          error.unreplayableReason,
          error.reason,
        );
      }

      this.logger.warn(
        { err: error, runId },
        'A run could not be checked for replaying',
      );
      return unreplayable(
        runId,
        taskId,
        stationId,
        'unchecked',
        'It could not be checked just now. Please try again later.',
      );
    }

    return { runId, taskId, stationId, unreplayableReason: null, reason: null };
  }
}

const unreplayable = (
  runId: string,
  taskId: string | null,
  stationId: string | null,
  unreplayableReason: UnreplayableReasonCode,
  reason: string,
): Replayability => ({ runId, taskId, stationId, unreplayableReason, reason });
