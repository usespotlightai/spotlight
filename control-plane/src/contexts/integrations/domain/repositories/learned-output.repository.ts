import type { LearnedOutput } from '@integrations/domain/aggregates/learned-output.aggregate';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const LEARNED_OUTPUTS = Symbol('LEARNED_OUTPUTS');

export interface LearnedOutputRepository {
  of(teamId: TeamId, tool: ToolName): Promise<LearnedOutput | null>;

  ofTools(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly LearnedOutput[]>;

  save(learned: LearnedOutput): Promise<void>;

  deleteForSource(teamId: TeamId, source: SourceKey): Promise<void>;

  deleteForTeam(teamId: TeamId): Promise<void>;
}
