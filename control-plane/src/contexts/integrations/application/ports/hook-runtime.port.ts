import type { HookCall } from '@integrations/application/ports/hook-calls.port';
import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import type { Hook } from '@integrations/domain/value-objects/hook.vo';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type {
  HookStepOutcome,
  WaitingHookStep,
} from '@integrations/domain/value-objects/hook-step-outcome.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOOK_RUNTIME = Symbol('HOOK_RUNTIME');

export interface HookEventInstance {
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly at: Date;
  readonly task: TaskView;
  readonly event: Readonly<Record<string, unknown>>;
  readonly firing: HookFiringId | null;
}

export interface ListeningHook {
  readonly id: HookDefinitionId;
  readonly key: HookKey;
  readonly teamId: TeamId;
  readonly blocks: boolean;
  readonly broken: string | null;
  readonly written: Hook | null;
}

export interface StepResult {
  readonly outcome: HookStepOutcome;
  readonly denyReason: string | null;
  readonly trace: HookCall | null;
}

export type WaitMode = 'wait' | 'suspend';

export interface StepRequest {
  readonly hook: ListeningHook;
  readonly step: string;
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
      readonly name: string;
      readonly tool: ToolName;
      readonly with: unknown;
    }
  | {
      readonly kind: 'request';
      readonly name: string;
      readonly url: URL;
      readonly headers: Readonly<Record<string, string>>;
      readonly body: string;
      readonly fromNetwork: boolean;
      readonly signing: HookRequestSigning | null;
    }
  | {
      readonly kind: 'unwritable';
      readonly name: string;
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
    step: string,
    instance: HookEventInstance,
    earlier: readonly HookStepOutcome[],
  ): WrittenStep;
}
