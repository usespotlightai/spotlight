import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_TOOLS = Symbol('HOOK_TOOLS');

export interface HookTools {
  readonly hook: HookKey;
  readonly tools: readonly ToolName[];
}

export interface HookToolsPort {
  ofTeam(teamId: TeamId): Promise<readonly HookTools[]>;
}
