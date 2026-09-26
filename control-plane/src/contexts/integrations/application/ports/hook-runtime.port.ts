import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookFailureCode } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookCallTrace } from '@work/application/ports/hook-traces.port';
import type { HookedTaskDto } from '@work/application/ports/hooked-tasks.port';

export const HOOK_RUNTIME = Symbol('HOOK_RUNTIME');

export interface HookMoment {
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly at: Date;
  readonly task: HookedTaskDto;
  readonly event: Readonly<Record<string, unknown>>;
  readonly firing: string | null;
}

export interface ListeningHook {
  readonly id: string;
  readonly key: string;
  readonly teamId: string;
  readonly blocks: boolean;
  readonly timeoutSeconds: number;
  readonly steps: readonly string[];
  readonly broken: string | null;
}

export type StepOutcome =
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
      readonly until: string;
    };

export interface StepTaken {
  readonly outcome: StepOutcome;
  readonly refusal: string | null;
  readonly trace: HookCallTrace | null;
}

export type Waiting = 'until-answered' | 'hand-back';

export interface StepAsked {
  readonly hook: ListeningHook;
  readonly step: string;
  readonly moment: HookMoment;
  readonly earlier: readonly StepOutcome[];
  readonly resuming: StepOutcome | null;
  readonly deadline: Date;
  readonly waiting: Waiting;
}

export interface HookRuntimePort {
  listening(
    teamId: string,
    on: HookEventName,
  ): Promise<readonly ListeningHook[]>;

  hook(hookId: string): Promise<ListeningHook | null>;

  matches(hook: ListeningHook, moment: HookMoment): boolean;

  step(asked: StepAsked): Promise<StepTaken>;
}
