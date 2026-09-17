import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ToolInputValues } from '@work/application/contracts/tools.contract';

export const CONTRIBUTED_TOOLS = Symbol('CONTRIBUTED_TOOLS');

export interface TaskToolCall {
  readonly runId: RunId;
  readonly taskId: TaskId | null;
  readonly workspaceId: WorkspaceId;
  readonly stationCheck: string | null;
}

export interface ContributedTaskTool {
  readonly tool: string;
  call(call: TaskToolCall, inputs: ToolInputValues): Promise<unknown>;
}
