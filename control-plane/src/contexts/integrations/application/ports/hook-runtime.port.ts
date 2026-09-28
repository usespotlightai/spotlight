import type { HookCall } from '@integrations/application/ports/hook-calls.port';
import type { HookedTask } from '@integrations/application/ports/tasks-for-hooks.port';
import type { HookStepOutcome } from '@integrations/domain/aggregates/hook-firing.aggregate';
import type { Hook } from '@integrations/domain/entities/hook.entity';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';

export const HOOK_RUNTIME = Symbol('HOOK_RUNTIME');

export interface HookMoment {
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly at: Date;
  readonly task: HookedTask;
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
  readonly written: Hook | null;
}

export type StepOutcome = HookStepOutcome;

export interface StepTaken {
  readonly outcome: StepOutcome;
  readonly refusal: string | null;
  readonly trace: HookCall | null;
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
