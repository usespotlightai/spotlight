import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import type { IntegrationToolCallsPort } from '@work/application/ports/integration-tool-calls.port';
import type {
  IntegrationToolsPort,
  ReachableTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type { TaskBindings } from '@work/application/services/task-bindings.service';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export class IntegrationTools implements IntegrationToolsPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly bindings: TaskBindings,
    private readonly calls: IntegrationToolCallsPort,
  ) {}

  async reach(tool: Tool, context: ToolContext): Promise<ReachableTool | null> {
    if (context.kind !== 'task') {
      return null;
    }

    const [task, line] = await Promise.all([
      this.tasks.find(context.taskId),
      this.lines.holding(context.stationId),
    ]);
    const bound = task && line ? await this.bindings.of(task, line) : null;
    const found = bound ? await this.calls.reach(tool.value, bound) : null;

    return found
      ? {
          declared: ToolDeclarationMapper.toDeclared(found.declared),
          defaultFor: (input) => found.defaultFor(input),
          call: (inputs) => found.call(inputs.values),
        }
      : null;
  }
}
