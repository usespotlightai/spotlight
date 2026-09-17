import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type {
  DeclaredTool,
  ToolInput,
} from '@work/domain/value-objects/declared-tool.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export const INTEGRATION_TOOLS = Symbol('INTEGRATION_TOOLS');

export interface TaskToolContext {
  readonly kind: 'task';
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
  readonly stationCheck: string | null;
}

export interface ChatToolContext {
  readonly kind: 'chat';
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId;
  readonly teamId: TeamId;
}

export type ToolContext = TaskToolContext | ChatToolContext;

export interface ReachableTool {
  readonly declared: DeclaredTool;
  defaultFor(input: ToolInput): unknown;
  call(inputs: ToolInputs): Promise<unknown>;
}

export interface IntegrationToolsPort {
  reach(tool: Tool, context: ToolContext): Promise<ReachableTool | null>;
}
