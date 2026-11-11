import type { HookCall } from '@integrations/application/ports/hook-calls.port';
import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEventFacts } from '@integrations/domain/value-objects/hook-event-facts.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import type { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import type {
  HookStepOutcome,
  WaitingHookStep,
} from '@integrations/domain/value-objects/hook-step-outcome.vo';
import type { Hook } from '@integrations/domain/value-objects/hook.vo';
import type { RunAttemptRef } from '@integrations/domain/value-objects/run-attempt-ref.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_RUNTIME = Symbol('HOOK_RUNTIME');

export interface HookEventInstance {
  readonly on: HookEventName;
  readonly occurrence: HookOccurrenceKey;
  readonly at: Date;
  readonly task: TaskView;
  readonly run: RunAttemptRef | null;
  readonly event: HookEventFacts;
  readonly firing: HookFiringId | null;
}

declare const COMPILED_HOOK: unique symbol;

export interface CompiledHook {
  readonly [COMPILED_HOOK]: true;
}

export interface ListeningHook {
  readonly id: HookDefinitionId;
  readonly key: HookKey;
  readonly teamId: TeamId;
  readonly blocks: boolean;
  readonly broken: string | null;
  readonly written: Hook | null;
  readonly compiled: CompiledHook | null;
}

export interface StepResult {
  readonly outcome: HookStepOutcome;
  readonly denyReason: string | null;
  readonly trace: HookCall | null;
}

export type WaitMode = 'wait' | 'suspend';

export interface StepRequest {
  readonly hook: ListeningHook;
  readonly step: HookStepName;
  readonly instance: HookEventInstance;
  readonly earlier: readonly HookStepOutcome[];
  readonly resuming: WaitingHookStep | null;
  readonly deadline: Date;
  readonly waitMode: WaitMode;
}

export type HookRequestSigning =
  | { readonly kind: 'hmac' }
  | { readonly kind: 'oidc'; readonly audience: string };

export type WrittenStep =
  | {
      readonly kind: 'call';
      readonly name: HookStepName;
      readonly tool: ToolName;
      readonly with: unknown;
    }
  | {
      readonly kind: 'request';
      readonly name: HookStepName;
      readonly url: URL;
      readonly headers: Readonly<Record<string, string>>;
      readonly body: string;
      readonly fromNetwork: boolean;
      readonly signing: HookRequestSigning | null;
    }
  | {
      readonly kind: 'unwritable';
      readonly name: HookStepName;
      readonly failure: HookFailure;
    };

export interface HookRuntimePort {
  listening(
    teamId: TeamId,
    on: HookEventName,
  ): Promise<readonly ListeningHook[]>;

  hook(hookId: HookDefinitionId): Promise<ListeningHook | null>;

  whenHolds(hook: ListeningHook, instance: HookEventInstance): boolean;

  written(
    hook: ListeningHook,
    step: HookStepName,
    instance: HookEventInstance,
    earlier: readonly HookStepOutcome[],
  ): WrittenStep;
}
