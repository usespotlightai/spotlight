import type { HookFailureCode } from '@integrations/domain/value-objects/hook-failure.vo';

export type HookStepOutcome =
  | {
      readonly name: string;
      readonly status: 'done';
      readonly output: unknown;
    }
  | {
      readonly name: string;
      readonly status: 'failed';
      readonly code: HookFailureCode;
      readonly reason: string;
      readonly output: unknown;
    }
  | {
      readonly name: string;
      readonly status: 'waiting';
      readonly call: string;
      readonly until: Date;
    };

export type WaitingHookStep = Extract<
  HookStepOutcome,
  { readonly status: 'waiting' }
>;

export const waitExpiredAt = (waiting: WaitingHookStep, now: Date): boolean =>
  waiting.until.getTime() <= now.getTime();
