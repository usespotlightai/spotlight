import type { WornSecret } from '@configuration/application/ports/integration-configs.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface McpServerDto {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export interface HarnessProfileResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly teamId: string;
  readonly key: string;
  readonly permissions: {
    readonly allow: readonly string[];
    readonly ask: readonly string[];
    readonly deny: readonly string[];
  };
  readonly mcpServers: readonly McpServerDto[];
  readonly native: Readonly<Record<string, unknown>>;
  readonly secretsWorn: readonly WornSecret[];
  readonly warnings: readonly ConfigurationProblem[];
}
