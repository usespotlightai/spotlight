import type {
  ResourceCreated,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface InferenceEndpointResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly baseUrl: string;
  readonly model: string;
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

interface Probed {
  readonly warnings: readonly ConfigurationProblem[];
}

type Created = Extract<ResourceCreated, { outcome: 'created' }>;

type Updated = Extract<ResourceUpdated, { outcome: 'updated' }>;

export type InferenceEndpointCreated =
  | Exclude<ResourceCreated, Created>
  | (Created & Probed);

export type InferenceEndpointUpdated =
  | Exclude<ResourceUpdated, Updated>
  | (Updated & Probed);
