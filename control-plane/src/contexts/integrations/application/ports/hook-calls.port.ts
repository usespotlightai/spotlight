import type { HookRunAttempt } from '@integrations/domain/value-objects/hook-run-attempt.vo';

export const HOOK_CALLS = Symbol('HOOK_CALLS');

export interface HookCall {
  readonly hook: string;
  readonly step: string;
  readonly kind: 'call' | 'request';
  readonly target: string;
  readonly request: unknown;
  readonly response: unknown;
  readonly status: number | null;
  readonly failed: boolean;
  readonly startedAt: Date;
  readonly ms: number;
}

export interface HookCallsPort {
  record(run: HookRunAttempt, call: HookCall): Promise<void>;
}
