import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface IntegrationResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly teamId: string;
  readonly source: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly warnings: readonly ConfigurationProblem[];
}

type Refused =
  | { readonly outcome: 'moved-on'; readonly currentVersion: number }
  | { readonly outcome: 'in-use'; readonly reason: string };

export type IntegrationCreatedDto =
  | {
      readonly outcome: 'created';
      readonly id: string;
      readonly replayed: boolean;
    }
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly ConfigurationProblem[];
    }
  | { readonly outcome: 'taken'; readonly address: string }
  | { readonly outcome: 'key-reused' };

export type IntegrationUpdatedDto =
  | { readonly outcome: 'updated'; readonly id: string }
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly ConfigurationProblem[];
    }
  | Refused;

export type IntegrationDeletedDto = { readonly outcome: 'deleted' } | Refused;
