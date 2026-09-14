import type { Line } from '@domain/aggregates/line.aggregate';
import type { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type {
  DeclaredTool,
  ToolInput,
} from '@domain/entities/declared-tool.entity';
import type { Tool } from '@domain/value-objects/tool.vo';
import type { ToolInputs } from '@domain/value-objects/tool-inputs.vo';

export const INTEGRATION_TOOLS = Symbol('INTEGRATION_TOOLS');

export interface ToolContext {
  readonly run: Run;
  readonly task: Task;
  readonly line: Line;
}

export interface ReachableTool {
  readonly declared: DeclaredTool;
  defaultFor(input: ToolInput): unknown;
  call(inputs: ToolInputs): Promise<unknown>;
}

export interface IntegrationToolsPort {
  reach(tool: Tool, context: ToolContext): Promise<ReachableTool | null>;
}
