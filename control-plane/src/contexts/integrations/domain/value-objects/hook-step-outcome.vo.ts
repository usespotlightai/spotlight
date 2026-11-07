import type { HookFailureCode } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';

export type HookStepOutcome =
  | {
      readonly name: HookStepName;
      readonly status: 'done';
      readonly output: unknown;
    }
  | {
      readonly name: HookStepName;
      readonly status: 'failed';
      readonly code: HookFailureCode;
      readonly reason: string;
      readonly output: unknown;
    }
  | {
      readonly name: HookStepName;
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
