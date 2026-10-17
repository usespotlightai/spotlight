import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { Permission } from '@shared-kernel/domain/value-objects/permission';

export interface Invalid {
  readonly outcome: 'invalid';
  readonly problems: readonly ConfigurationProblem[];
}

export type ForbiddenAct = Exclude<Permission, 'read'>;

export interface Forbidden {
  readonly outcome: 'forbidden';
  readonly act: ForbiddenAct;
}

export const forbiddenTo = (act: ForbiddenAct): Forbidden => ({
  outcome: 'forbidden',
  act,
});

export type Refused =
  | { readonly outcome: 'version-conflict'; readonly currentVersion: number }
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
