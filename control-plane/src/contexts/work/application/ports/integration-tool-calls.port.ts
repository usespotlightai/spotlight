import type {
  ToolDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';

export const INTEGRATION_TOOL_CALLS = Symbol('INTEGRATION_TOOL_CALLS');

export interface RunAttemptDto {
  readonly runId: string;
  readonly attempt: number;
}

export interface ToolActingAsDto {
  readonly holder: 'team' | 'person';
  readonly personId: string | null;
  readonly handle: string | null;
}

export interface ConnectionWantedDto {
  readonly source: string;
  readonly integration: string;
  readonly personId: string | null;
  readonly because:
    | 'not-connected'
    | 'renewal-refused'
    | 'no-requester'
    | 'not-a-member';
}

export interface IntegrationTool {
  readonly declared: ToolDeclaration;
  readonly actingAs: ToolActingAsDto | null;
  readonly wants: ConnectionWantedDto | null;
  defaultFor(input: string): unknown;
  call(inputs: ToolInputValues): Promise<unknown>;
}

export interface IntegrationToolCallsPort {
  reach(
    tool: string,
    task: BoundTaskDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null>;
}
