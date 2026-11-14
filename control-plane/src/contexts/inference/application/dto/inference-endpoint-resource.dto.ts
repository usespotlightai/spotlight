import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface InferenceEndpointResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly supportsReasoningEffort: boolean;
  readonly apiKeySet: boolean;
  readonly apiKeyVersion: number | null;
  readonly warnings: readonly ConfigurationProblem[];
}

export type ConnectionTested =
  | {
      readonly outcome: 'tested';
      readonly ok: boolean;
      readonly message: string;
    }
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly ConfigurationProblem[];
    }
  | { readonly outcome: 'forbidden'; readonly act: string };
