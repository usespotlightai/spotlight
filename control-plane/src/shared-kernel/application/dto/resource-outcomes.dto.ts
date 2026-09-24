import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface Invalid {
  readonly outcome: 'invalid';
  readonly problems: readonly ConfigurationProblem[];
}

export type ForbiddenAct = 'change' | 'administer' | 'open-workspace' | 'plan';

export interface Forbidden {
  readonly outcome: 'forbidden';
  readonly act: ForbiddenAct;
}

const forbiddenTo = (act: ForbiddenAct): Forbidden => ({
  outcome: 'forbidden',
  act,
});

export const FORBIDDEN = forbiddenTo('change');

export const FORBIDDEN_TO_ADMINISTER = forbiddenTo('administer');

export const FORBIDDEN_TO_OPEN_WORKSPACES = forbiddenTo('open-workspace');

export const FORBIDDEN_TO_PLAN = forbiddenTo('plan');

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
