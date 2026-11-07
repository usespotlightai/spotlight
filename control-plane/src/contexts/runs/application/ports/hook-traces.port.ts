export const HOOK_TRACES = Symbol('HOOK_TRACES');

export interface HookCallTrace {
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

export interface HookTracesPort {
  record(runId: string, call: HookCallTrace): Promise<void>;
}
