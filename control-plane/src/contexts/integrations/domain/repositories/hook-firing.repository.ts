import type { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';

export const HOOK_FIRINGS = Symbol('HOOK_FIRINGS');

export interface HookFiringRepository {
  add(firing: HookFiring): Promise<boolean>;

  withId(id: string): Promise<HookFiring | null>;

  // Must be atomic: two workers must never hold the same firing.
  claimNext(now: Date): Promise<HookFiring | null>;

  save(firing: HookFiring): Promise<void>;

  finishedBefore(at: Date, max: number): Promise<readonly HookFiring[]>;
}
