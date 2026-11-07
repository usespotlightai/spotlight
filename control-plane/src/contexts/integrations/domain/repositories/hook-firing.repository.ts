import type { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';

export const HOOK_FIRINGS = Symbol('HOOK_FIRINGS');

export interface HookFiringRepository {
  add(firing: HookFiring): Promise<boolean>;

  withId(id: HookFiringId): Promise<HookFiring | null>;

  // Must be atomic: two workers must never have a lease on the same firing.
  claimNext(now: Date): Promise<HookFiring | null>;

  save(firing: HookFiring): Promise<void>;

  finishedBefore(at: Date, max: number): Promise<readonly HookFiring[]>;
}
