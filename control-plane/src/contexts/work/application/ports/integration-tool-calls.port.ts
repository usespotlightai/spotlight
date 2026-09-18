import type {
  ToolDeclaration,
  ToolInputDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';

export const INTEGRATION_TOOL_CALLS = Symbol('INTEGRATION_TOOL_CALLS');

export interface IntegrationTool {
  readonly declared: ToolDeclaration;
  defaultFor(input: ToolInputDeclaration): unknown;
  call(inputs: ToolInputValues): Promise<unknown>;
}

export interface IntegrationToolCallsPort {
  reach(tool: string, task: BoundTaskDto): Promise<IntegrationTool | null>;
}
