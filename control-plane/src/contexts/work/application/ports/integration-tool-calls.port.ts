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

export interface ConnectionMissingDto {
  readonly integration: string;
  readonly integrationName: string;
  readonly personId: string | null;
  readonly because:
    | 'not-connected'
    | 'refresh-failed'
    | 'no-requester'
    | 'not-a-member';
}

export interface PersonRuleDto {
  readonly rule: 'allowed' | 'needs-approval' | 'blocked';
  readonly personId: string;
  readonly personName: string;
}

export interface IntegrationTool {
  readonly declared: ToolDeclaration;
  readonly actingAs: ToolActingAsDto | null;
  readonly missing: ConnectionMissingDto | null;
  readonly personRule: PersonRuleDto | null;
  defaultFor(input: string): unknown;
  call(inputs: ToolInputValues): Promise<unknown>;
}

export interface IntegrationToolCallsPort {
  resolve(
    tool: string,
    task: IntegrationTaskViewDto,
    run: RunAttemptDto,
    requester: string | null,
  ): Promise<IntegrationTool | null>;
}
