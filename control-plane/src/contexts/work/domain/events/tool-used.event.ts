import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import type { ToolOutput } from '@work/domain/value-objects/tool-output.vo';

export class ToolUsed implements DomainEvent {
  readonly kind = 'tool.used';

  constructor(
    readonly runId: RunId,
    readonly taskId: TaskId,
    readonly useId: string,
    readonly tool: Tool,
    readonly inputs: ToolInputs,
    readonly output: ToolOutput,
    readonly failed: boolean,
    readonly actingAs: ToolActingAs | null,
  ) {}
}
