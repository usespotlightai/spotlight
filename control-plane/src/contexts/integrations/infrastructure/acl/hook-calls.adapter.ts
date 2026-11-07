import type {
  HookCall,
  HookCallsPort,
} from '@integrations/application/ports/hook-calls.port';
import type { HookRunAttempt } from '@integrations/domain/value-objects/hook-run-attempt.vo';
import type { HookTracesPort } from '@runs/application/ports/hook-traces.port';

export class HookCalls implements HookCallsPort {
  constructor(private readonly traces: HookTracesPort) {}

  record(run: HookRunAttempt, call: HookCall): Promise<void> {
    return this.traces.record(run.runId.value, {
      attempt: run.attempt,
      hook: call.hook,
      step: call.step,
      kind: call.kind,
      target: call.target,
      request: call.request,
      response: call.response,
      status: call.status,
      failed: call.failed,
      startedAt: call.startedAt,
      ms: call.ms,
    });
  }
}
