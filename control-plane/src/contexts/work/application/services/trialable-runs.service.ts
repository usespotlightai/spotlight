import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UntrialableReasonCode } from '@work/application/contracts/untrialable-reason.contract';
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
import {
  type TrialArchive,
  trialBlockOf,
} from '@work/domain/services/trialability';
import type { UntrialableReason } from '@work/domain/value-objects/untrialable-reason';

const REASONS: Readonly<Record<UntrialableReason, UntrialableReasonCode>> = {
  'unknown-run': 'unknown-run',
  'not-a-task-run': 'not-a-task-run',
  'task-gone': 'task-gone',
  'still-running': 'still-running',
  'no-starting-point': 'no-starting-point',
  'no-briefing': 'no-briefing',
  'archive-gone': 'archive-gone',
  'attachments-gone': 'attachments-gone',
  'answer-gone': 'answer-gone',
  'repository-gone': 'repository-gone',
  'not-at-the-station': 'not-at-the-station',
  'candidate-unfit': 'candidate-unfit',
  'cannot-start': 'cannot-start',
};

const archiveOf = (run: RunFacts): TrialArchive =>
  run.startedFrom?.archiveId
    ? run.startedFrom.archiveStored
      ? 'stored'
      : 'gone'
    : 'none';

const summaryOf = (
  runId: string,
  workspaceId: string,
  run: RunFacts | null,
  ran: TaskRunFacts | null,
): TrialableRunSummary => {
  const inWorkspace = run?.workspaceId.value === workspaceId;
  const block = trialBlockOf(
    run && {
      inWorkspace,
      taskId: ran ? TaskId.of(ran.taskId) : null,
      stationId: ran ? StationId.of(ran.stationId) : null,
      ended: run.ended,
      startedFrom: run.startedFrom !== null,
      archive: archiveOf(run),
      briefed: ran?.briefed ?? false,
      taskExists: ran?.taskExists ?? false,
    },
  );
  const placed = inWorkspace ? run : null;
  const placedRun = placed ? ran : null;

  return {
    runId,
    taskId: placedRun?.taskId ?? null,
    stationId: placedRun?.stationId ?? null,
    untrialableReason: block ? REASONS[block.reason] : null,
    description: block?.description ?? null,
    title: placedRun?.title ?? null,
    state: placed?.state ?? null,
    endedAt: placed?.endedAt ?? null,
    origin: placedRun?.origin ?? null,
  };
};

export class TrialableRuns implements TrialableRunsPort {
  constructor(
    private readonly runs: RunFactsPort,
    private readonly trials: TrialFactsPort,
    private readonly stationRuns: StationRunReaderPort,
  ) {}

  async summaries(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly TrialableRunSummary[]> {
    const distinct = [...new Set(runIds)];
    const facts = await this.runs.of(distinct.map((each) => RunId.of(each)));
    const ran = await this.trials.ofTaskRuns(distinct);
    const known = new Map(facts.map((each) => [each.runId.value, each]));

    return distinct.map((runId) =>
      summaryOf(
        runId,
        workspaceId,
        known.get(runId) ?? null,
        ran.get(runId) ?? null,
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
