import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export const TEAM_INTEGRATIONS = Symbol('TEAM_INTEGRATIONS');

export interface OpeningSource {
  readonly source: string;
  readonly name: string;
  readonly tryIt: string | null;
  readonly heard: string | null;
  readonly link: { readonly label: string; readonly url: string } | null;
}

export interface TeamIntegrationsPort {
  offered(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]>;

  opening(teamId: TeamId): Promise<readonly OpeningSource[]>;
}
