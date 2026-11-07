import type {
  HookEventInstance,
  HookRequestSigning,
  ListeningHook,
  StepResult,
  WaitMode,
} from '@integrations/application/ports/hook-runtime.port';
import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import type { WaitingHookStep } from '@integrations/domain/value-objects/hook-step-outcome.vo';

export const HOOK_REQUESTS = Symbol('HOOK_REQUESTS');

export interface HookRequest {
  readonly hook: ListeningHook;
  readonly instance: HookEventInstance;
  readonly step: HookStepName;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly fromNetwork: boolean;
  readonly signing: HookRequestSigning | null;
  readonly deadline: Date;
  readonly waitMode: WaitMode;
}

export interface HookRequestsPort {
  sent(request: HookRequest, callback: string, now: Date): Promise<StepResult>;

  resumed(
    request: HookRequest,
    waiting: WaitingHookStep,
    now: Date,
  ): Promise<StepResult | null>;

  unanswered(request: HookRequest, now: Date): StepResult;

  notSent(request: HookRequest, failure: HookFailure, now: Date): StepResult;
}
