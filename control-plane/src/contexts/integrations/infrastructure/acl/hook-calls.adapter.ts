import type {
  HookCall,
  HookCallsPort,
} from '@integrations/application/ports/hook-calls.port';
import type { HookTracesPort } from '@work/application/ports/hook-traces.port';

export class HookCalls implements HookCallsPort {
  constructor(private readonly traces: HookTracesPort) {}

  record(runId: string, call: HookCall): Promise<void> {
    return this.traces.record(runId, {
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
