import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface Invalid {
  readonly outcome: 'invalid';
  readonly problems: readonly ConfigurationProblem[];
}

export interface Forbidden {
  readonly outcome: 'forbidden';
}

export const FORBIDDEN: Forbidden = { outcome: 'forbidden' };

export type Refused =
  | { readonly outcome: 'moved-on'; readonly currentVersion: number }
  | { readonly outcome: 'in-use'; readonly reason: string }
  | Forbidden;

export type ResourceCreated =
  | {
      readonly outcome: 'created';
      readonly id: string;
      readonly replayed: boolean;
    }
  | Invalid
  | { readonly outcome: 'taken'; readonly address: string }
  | { readonly outcome: 'key-reused' }
  | Forbidden;

export type ResourceUpdated =
  | { readonly outcome: 'updated'; readonly id: string }
  | Invalid
  | Refused;

export type ResourceDeleted = { readonly outcome: 'deleted' } | Refused;
