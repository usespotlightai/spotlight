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
import type {
  Dispatch,
  DispatchToolChange,
} from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { describedTools } from '@work/domain/services/enabled-for-run';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

interface ToolsOnMarks {
  readonly change: DispatchToolChange;
  readonly described: readonly DeclaredTool[];
}

const UNCHANGED: RunToolChangeShape = { removed: [], added: [] };

export class ResumeTaskRun {
  constructor(
    private readonly runs: RunsPort,
    private readonly dispatches: DispatchRepository,
    private readonly integrations: TeamIntegrations,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async resume({
    task,
    line,
    runId,
    attempt,
    because,
    checkouts,
  }: {
    task: Task;
    line: LineMap | null;
    runId: RunId;
    attempt: number | null;
    because: ResumedBecause;
    checkouts: readonly RunCheckoutShape[];
  }): Promise<void> {
    const dispatch = line ? await this.dispatches.find(runId) : null;
    const onMarks =
      line && dispatch ? await this.toolsOnMarks(task, line, dispatch) : null;

    await this.transaction.inTransaction(async () => {
      const resumed = await this.runs.resume(
        runId,
        attempt,
        because,
        checkouts,
        onMarks ? this.shapeOf(onMarks) : UNCHANGED,
      );

      if (resumed && onMarks && onMarks.change.dispatch !== dispatch) {
        await this.dispatches.save(onMarks.change.dispatch);
      }
    });
  }

  private async toolsOnMarks(
    task: Task,
    line: LineMap,
    dispatch: Dispatch,
  ): Promise<ToolsOnMarks | null> {
    let described: DeclaredTool[];

    try {
      const tools = await this.integrations.toolsOnMarks(line, task.marks);
      described = describedTools(
        tools,
        await this.integrations.provided(line, tools),
      );
    } catch (error) {
      this.logger.warn(
        { err: error, runId: dispatch.id.value, taskId: task.id.value },
        'Resuming the run with the tools it had, because the tools its task’s marks enable could not be read',
      );
      return null;
    }

    return {
      change: dispatch.withToolsOnMarks(described.map((each) => each.tool)),
      described,
    };
  }

  private shapeOf({ change, described }: ToolsOnMarks): RunToolChangeShape {
    return {
      removed: change.removed.map((each) => each.value),
      added: described
        .filter((each) => change.added.some((tool) => tool.equals(each.tool)))
        .map(toolManifestOf),
    };
  }
}
