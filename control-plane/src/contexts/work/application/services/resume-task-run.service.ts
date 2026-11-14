import type {
  RunCheckoutShape,
  RunToolChangeShape,
} from '@runs/application/contracts/run-spec.contract';
import type {
  ResumedBecause,
  RunsPort,
} from '@runs/application/ports/runs.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { DispatchToolChange } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { DispatchVersionConflictError } from '@work/domain/exceptions/dispatch-version-conflict.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { describedTools } from '@work/domain/services/enabled-for-run';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

const SAVE_ATTEMPTS = 3;

const UNCHANGED: RunToolChangeShape = { removed: [], added: [] };

const shapeOf = (
  change: DispatchToolChange,
  described: readonly DeclaredTool[],
): RunToolChangeShape => ({
  removed: change.removed.map((each) => each.value),
  added: described
    .filter((each) => change.added.some((tool) => tool.equals(each.tool)))
    .map(toolManifestOf),
});

export class ResumeTaskRun {
  constructor(
    private readonly runs: RunsPort,
    private readonly dispatches: DispatchRepository,
    private readonly integrations: TeamIntegrations,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async resume(input: {
    task: Task;
    line: LineMap | null;
    runId: RunId;
    attempt: number | null;
    because: ResumedBecause;
    checkouts: readonly RunCheckoutShape[];
  }): Promise<void> {
    const described = input.line
      ? await this.describedOnMarks(input.task, input.line, input.runId)
      : null;

    for (let attempt = 1; ; attempt++) {
      try {
        await this.transaction.inTransaction(() =>
          this.resumedWith(input, described),
        );
        return;
      } catch (error) {
        if (
          !(error instanceof DispatchVersionConflictError) ||
          attempt >= SAVE_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  private async resumedWith(
    {
      task,
      runId,
      attempt,
      because,
      checkouts,
    }: {
      task: Task;
      runId: RunId;
      attempt: number | null;
      because: ResumedBecause;
      checkouts: readonly RunCheckoutShape[];
    },
    described: readonly DeclaredTool[] | null,
  ): Promise<void> {
    const dispatch = described ? await this.dispatches.find(runId) : null;
    const change =
      dispatch && described
        ? dispatch.withToolsOnMarks(described.map((each) => each.tool))
        : null;
    const resumption = await this.runs.resume(
      runId,
      attempt,
      because,
      checkouts,
      change && described ? shapeOf(change, described) : UNCHANGED,
    );

    if (resumption === 'resumed-with-its-tools') {
      this.logger.warn(
        { runId: runId.value, taskId: task.id.value },
        'Resumed the run with the tools it had, because its policy keeps it from using the tools its task’s marks enable',
      );
    }

    if (resumption === 'resumed' && change && change.dispatch !== dispatch) {
      await this.dispatches.save(change.dispatch);
    }
  }

  private async describedOnMarks(
    task: Task,
    line: LineMap,
    runId: RunId,
  ): Promise<DeclaredTool[] | null> {
    try {
      const tools = await this.integrations.toolsOnMarks(line, task.marks);

      return describedTools(
        tools,
        await this.integrations.provided(line, tools),
      );
    } catch (error) {
      this.logger.warn(
        { err: error, runId: runId.value, taskId: task.id.value },
        'Resuming the run with the tools it had, because the tools its task’s marks enable could not be read',
      );
      return null;
    }
  }
}
