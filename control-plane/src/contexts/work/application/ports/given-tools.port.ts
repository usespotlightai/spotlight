import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const GIVEN_TOOLS = Symbol('GIVEN_TOOLS');

export interface GivenTool {
  readonly tool: string;
  readonly line: string;
  readonly station: string;
}

export interface GivenToolsPort {
  onTeam(teamId: TeamId): Promise<readonly GivenTool[]>;
}
