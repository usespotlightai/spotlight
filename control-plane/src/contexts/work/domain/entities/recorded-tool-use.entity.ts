import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import type { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import type { ToolOutput } from '@work/domain/value-objects/tool-output.vo';

export interface ToolUsingRun {
  readonly id: RunId;
  readonly attempt: number;
  readonly task: TaskId | null;
}

export class RecordedToolUse {
  private constructor(
    readonly runId: RunId,
    readonly attempt: number,
    readonly taskId: TaskId,
    readonly useId: string,
    readonly tool: Tool,
    readonly inputs: ToolInputs,
    readonly output: ToolOutput,
    readonly failed: boolean,
    readonly actingAs: ToolActingAs | null,
    readonly at: Date,
  ) {}

  static of(input: {
    run: ToolUsingRun;
    useId: string;
    tool: Tool;
    inputs: ToolInputs;
    output: ToolOutput;
    failed: boolean;
    actingAs: ToolActingAs | null;
    at: Date;
  }): RecordedToolUse | null {
    const { run } = input;

    return run.task
      ? new RecordedToolUse(
          run.id,
          run.attempt,
          run.task,
          input.useId,
          input.tool,
          input.inputs,
          input.output,
          input.failed,
          input.actingAs,
          input.at,
        )
      : null;
  }

  recordedFirst(inserted: boolean): ToolUsed | null {
    return inserted
      ? new ToolUsed(
          this.runId,
          this.taskId,
          this.useId,
          this.tool,
          this.inputs,
          this.output,
          this.failed,
          this.actingAs,
        )
      : null;
  }
}
