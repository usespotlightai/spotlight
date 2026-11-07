import type {
  ToolDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';

export const INTEGRATION_TOOL_CALLS = Symbol('INTEGRATION_TOOL_CALLS');

export interface RunAttemptDto {
  readonly runId: string;
  readonly attempt: number;
}

export interface ToolActingAsDto {
  readonly actsAs: 'team' | 'requester';
  readonly personId: string | null;
  readonly linkedAccount: string | null;
}

export type MissingConnectionReason =
  | 'not-connected'
  | 'refresh-failed'
  | 'no-requester'
  | 'not-a-member';

export interface ConnectionMissingDto {
  readonly integration: string;
  readonly integrationName: string;
  readonly personId: string | null;
  readonly because: MissingConnectionReason;
}

export interface PersonRuleDto {
  readonly rule: 'allowed' | 'needs-approval' | 'blocked';
  readonly personId: string;
  readonly personName: string;
}

export interface ToolCallFailureDto {
  readonly blocked: boolean;
  readonly reason: string;
}

export type ToolCallResultDto =
  | { readonly outcome: 'answered'; readonly output: unknown }
  | { readonly outcome: 'failed'; readonly failure: ToolCallFailureDto };

export interface IntegrationTool {
  readonly declared: ToolDeclaration;
  readonly actingAs: ToolActingAsDto | null;
  readonly missing: ConnectionMissingDto | null;
  readonly personRule: PersonRuleDto | null;
  defaultFor(input: string): unknown;
  call(inputs: ToolInputValues): Promise<ToolCallResultDto>;
}

export interface IntegrationToolCallsPort {
  resolve(
    tool: string,
    task: IntegrationTaskViewDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null>;
}
