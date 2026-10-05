import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export const TEAM_INTEGRATIONS = Symbol('TEAM_INTEGRATIONS');

export interface TeamIntegrationsPort {
  offered(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]>;
}
