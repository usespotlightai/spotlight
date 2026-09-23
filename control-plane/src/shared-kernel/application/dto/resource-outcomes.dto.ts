import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface Invalid {
  readonly outcome: 'invalid';
  readonly problems: readonly ConfigurationProblem[];
}

export type Refused =
  | { readonly outcome: 'moved-on'; readonly currentVersion: number }
  | { readonly outcome: 'in-use'; readonly reason: string };

export type ResourceCreated =
  | {
      readonly outcome: 'created';
      readonly id: string;
      readonly replayed: boolean;
    }
  | Invalid
  | { readonly outcome: 'taken'; readonly address: string }
  | { readonly outcome: 'key-reused' };

export type ResourceUpdated =
  | { readonly outcome: 'updated'; readonly id: string }
  | Invalid
  | Refused;

export type ResourceDeleted = { readonly outcome: 'deleted' } | Refused;
