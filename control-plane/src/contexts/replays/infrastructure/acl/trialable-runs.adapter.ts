import type {
  PickableRun,
  RunReplayability,
  RunSummary,
  TrialableRunsPort,
} from '@replays/application/ports/trialable-runs.port';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { UntrialableReasonCode } from '@work/application/contracts/untrialable-reason.contract';
import type {
  Trialability,
  TrialableRunsPort as WorkTrialableRunsPort,
} from '@work/application/ports/trialable-runs.port';

export const UNTRIALABLE: Readonly<
  Record<UntrialableReasonCode, UnreplayableReason>
> = {
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

const replayabilityOf = (each: Trialability): RunReplayability => ({
  runId: RunId.of(each.runId),
  taskId: each.taskId ? TaskId.of(each.taskId) : null,
  stationId: each.stationId === null ? null : StationId.of(each.stationId),
  unreplayableReason:
    each.untrialableReason && UNTRIALABLE[each.untrialableReason],
  reason: each.description,
});

export class TrialableRuns implements TrialableRunsPort {
  constructor(private readonly runs: WorkTrialableRunsPort) {}

  async runSummaries(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunSummary[]> {
    if (runs.length === 0) {
      return [];
    }

    return (
      await this.runs.summaries(
        workspaceId.value,
        runs.map((each) => each.value),
      )
    ).map((each) => ({
      ...replayabilityOf(each),
      title: each.title,
      endedAt: each.endedAt,
    }));
  }

  async recentAt(
    workspaceId: WorkspaceId,
    stationId: StationId,
    max: number,
  ): Promise<readonly PickableRun[]> {
    return (
      await this.runs.recentAt(workspaceId.value, stationId.value, max)
    ).map((each) => ({
      ...replayabilityOf(each),
      endedAt: each.endedAt,
    }));
  }
}
