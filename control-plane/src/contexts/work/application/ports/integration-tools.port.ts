import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ConnectionWantedDto } from '@work/application/ports/integration-tool-calls.port';
import type { PersonRule } from '@work/domain/services/stricter-rule';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type {
  DeclaredTool,
  ToolInput,
} from '@work/domain/value-objects/declared-tool.vo';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import type { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export const INTEGRATION_TOOLS = Symbol('INTEGRATION_TOOLS');

export interface TaskToolContext {
  readonly kind: 'task';
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
  readonly requester: UserId | null;
}

export interface ChatToolContext {
  readonly kind: 'chat';
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId;
  readonly teamId: TeamId;
  readonly requester: UserId | null;
}

export type ToolContext = TaskToolContext | ChatToolContext;

export interface ReachableTool {
  readonly declared: DeclaredTool;
  readonly actingAs: ToolActingAs | null;
  readonly wants: ConnectionWantedDto | null;
  readonly personRule: PersonRule | null;
  defaultFor(input: ToolInput): unknown;
  call(inputs: ToolInputs): Promise<unknown>;
}

export interface IntegrationToolsPort {
  reach(
    tool: Tool,
    context: ToolContext,
    attempt: RunAttempt,
    runnerId: string,
  ): Promise<ReachableTool | null>;
}
