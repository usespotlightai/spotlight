import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface OidcTrustResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly key: string;
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
  readonly claims: Readonly<Record<string, string>>;
  readonly scopes: readonly string[];
  readonly lifetimeMinutes: number;
  readonly createdBy: string;
  readonly warnings: readonly ConfigurationProblem[];
}
