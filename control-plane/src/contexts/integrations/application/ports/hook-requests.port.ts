import type {
  HookEventInstance,
  HookRequestSigning,
  ListeningHook,
  StepOutcome,
  StepResult,
  WaitMode,
} from '@integrations/application/ports/hook-runtime.port';
import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';

export const HOOK_REQUESTS = Symbol('HOOK_REQUESTS');

export interface HookRequest {
  readonly hook: ListeningHook;
  readonly instance: HookEventInstance;
  readonly step: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly fromNetwork: boolean;
  readonly signing: HookRequestSigning | null;
  readonly deadline: Date;
  readonly waitMode: WaitMode;
}

export type WaitingOutcome = Extract<StepOutcome, { status: 'waiting' }>;

export interface HookRequestsPort {
  sent(request: HookRequest, callback: string, now: Date): Promise<StepResult>;

  resumed(
    request: HookRequest,
    waiting: WaitingOutcome,
    now: Date,
  ): Promise<StepResult>;

  notSent(request: HookRequest, failure: HookFailure, now: Date): StepResult;
}
