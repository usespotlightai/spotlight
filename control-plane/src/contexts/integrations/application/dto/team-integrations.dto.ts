import type {
  ConnectionProblem,
  IntegrationConnectionStatus,
} from '@integrations/domain/services/integration-connection-status';
import type { ActsAsKind } from '@integrations/domain/value-objects/acts-as.vo';

export interface TeamIntegrationSpecDto {
  readonly kind: string;
  readonly tools: number;
  readonly readAt: string;
  readonly problem: string | null;
}

export interface TeamIntegrationDto {
  readonly integration: string;
  readonly name: string;
  readonly logo: string | null;
  readonly path: string;
  readonly connectionStatus: IntegrationConnectionStatus;
  readonly connectionProblem: ConnectionProblem | null;
  readonly actsAs: ActsAsKind;
  readonly linkedAccount: string | null;
  readonly spec: TeamIntegrationSpecDto | null;
}

export interface TeamIntegrationsDto {
  readonly integrations: readonly TeamIntegrationDto[];
}
