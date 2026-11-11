import type { ActsAsKind } from '@integrations/domain/value-objects/acts-as.vo';
import type { ApiSpecKind } from '@integrations/domain/value-objects/api-spec.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_INTEGRATION_READINGS = Symbol('TEAM_INTEGRATION_READINGS');

export interface TeamIntegrationReading {
  readonly integration: string;
  readonly path: string;
  readonly name: string;
  readonly logo: string | null;
  readonly requiresConnection: boolean;
  readonly actsAs: ActsAsKind;
  readonly spec: {
    readonly kind: ApiSpecKind;
    readonly tools: number;
    readonly readAt: Date;
    readonly problem: string | null;
  } | null;
}

export interface TeamIntegrationReadingsPort {
  ofTeam(teamId: TeamId): Promise<readonly TeamIntegrationReading[]>;
}
