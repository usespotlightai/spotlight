import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TrialabilityMapper } from '@work/application/mappers/trialability.mapper';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { StationRunReaderPort } from '@work/application/ports/station-run-reader.port';
import type {
  TaskRunFacts,
  TrialFactsPort,
} from '@work/application/ports/trial-facts.port';
import type {
  RecentTrialableRun,
  TrialableRunSummary,
  TrialableRunsPort,
} from '@work/application/ports/trialable-runs.port';
import { repositoriesReviewedOrAll } from '@work/domain/services/task-checkouts';
import {
  type TrialBlock,
  trialBlockOf,
  trialRepositoriesBlockOf,
} from '@work/domain/services/trialability';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

const repositoriesBlockOf = (
  run: RunFacts,
  ran: TaskRunFacts,
  line: LineMap | null,
): TrialBlock | null =>
  line && run.startedFrom
    ? trialRepositoriesBlockOf(
        TrialabilityMapper.checkoutsIn(line, run.startedFrom.checkouts),
        repositoriesReviewedOrAll(
          ran.reviewing ? Repository.of(ran.reviewing) : null,
          line,
        ),
      )
    : null;

const summaryOf = (
  runId: string,
  workspaceId: string,
  run: RunFacts | null,
  ran: TaskRunFacts | null,
  line: LineMap | null,
): TrialableRunSummary => {
  const inWorkspace = run?.workspaceId.value === workspaceId;
  const blocked = trialBlockOf(
    run && {
      inWorkspace,
      taskId: ran ? TaskId.of(ran.taskId) : null,
      stationId: ran ? StationId.of(ran.stationId) : null,
      ended: run.ended,
      startedFrom: run.startedFrom !== null,
      archive: TrialabilityMapper.archiveOf(run),
      briefed: ran?.briefed ?? false,
      taskExists: ran?.taskExists ?? false,
    },
  );
  const block =
    blocked ?? (run && ran ? repositoriesBlockOf(run, ran, line) : null);
  const placed = inWorkspace ? run : null;
  const placedRun = placed ? ran : null;

  return {
    runId,
    taskId: placedRun?.taskId ?? null,
    stationId: placedRun?.stationId ?? null,
    untrialableReason: block
      ? TrialabilityMapper.reasonCode(block.reason)
      : null,
    description: block?.description ?? null,
    title: placedRun?.title ?? null,
    state: placed?.state ?? null,
    endedAt: placed?.endedAt ?? null,
  };
};

export class TrialableRuns implements TrialableRunsPort {
  constructor(
    private readonly runs: RunFactsPort,
    private readonly trials: TrialFactsPort,
    private readonly stationRuns: StationRunReaderPort,
    private readonly lines: LineMapsPort,
  ) {}

  async summaries(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly TrialableRunSummary[]> {
    const distinct = [...new Set(runIds)];
    const facts = await this.runs.of(distinct.map((each) => RunId.of(each)));
    const ran = await this.trials.ofTaskRuns(distinct);
    const known = new Map(facts.map((each) => [each.runId.value, each]));
    const lines = await this.linesAt([
      ...new Set([...ran.values()].map((each) => each.stationId)),
    ]);

    return distinct.map((runId) => {
      const task = ran.get(runId) ?? null;

      return summaryOf(
        runId,
        workspaceId,
        known.get(runId) ?? null,
        task,
        task ? (lines.get(task.stationId) ?? null) : null,
      );
    });
  }

  private async linesAt(
    stations: readonly string[],
  ): Promise<ReadonlyMap<string, LineMap | null>> {
    return new Map(
      await Promise.all(
        stations.map(
          async (station) =>
            [
              station,
              await this.lines.findByStation(StationId.of(station)),
            ] as const,
        ),
      ),
    );
  }

  async recentAt(
    workspaceId: string,
    stationId: string,
    max: number,
  ): Promise<readonly RecentTrialableRun[]> {
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
      const trialable = checked.get(each.runId);

      return trialable && trialable.untrialableReason !== 'unknown-run'
        ? [
            {
              ...trialable,
              title: each.title,
              state: each.state,
              endedAt: each.endedAt,
            },
          ]
        : [];
    });
  }
}
