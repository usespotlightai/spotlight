import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const DEFINED_INTEGRATIONS = Symbol('DEFINED_INTEGRATIONS');

interface DefinedReading {
  readonly readAt: Date;
  readonly problem: string | null;
  readonly passedOver: readonly string[];
}

export interface DefinedIntegration {
  readonly id: string;
  readonly version: number;
  readonly source: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly offers: readonly string[];
  readonly generatedFrom: string | null;
  readonly reading: DefinedReading | null;
}

export interface TeamDefinedIntegrations {
  readonly teamId: TeamId;
  readonly integrations: readonly DefinedIntegration[];
}

export interface DefinedIntegrationsPort {
  ofTeam(teamId: TeamId): Promise<readonly DefinedIntegration[]>;

  everywhere(): Promise<readonly TeamDefinedIntegrations[]>;
}
