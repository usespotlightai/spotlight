import type { LockInfo } from '@configuration/domain/value-objects/state-lock.vo';
import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';

export type StateRead =
  | { readonly outcome: 'found'; readonly body: Uint8Array }
  | { readonly outcome: 'empty' }
  | Forbidden
  | null;

export type StateChanged =
  | { readonly outcome: 'done' }
  | { readonly outcome: 'locked'; readonly holder: LockInfo }
  | Forbidden
  | null;
