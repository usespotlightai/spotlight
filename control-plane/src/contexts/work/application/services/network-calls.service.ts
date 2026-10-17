import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  NetworkCallState,
  NetworkCallsPort,
  NetworkRequest as Request,
} from '@work/application/ports/network-calls.port';
import { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { NetworkCallVersionConflictError } from '@work/domain/exceptions/network-call-version-conflict.error';
import { UnknownNetworkCallError } from '@work/domain/exceptions/unknown-network-call.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';

const POLL_INTERVAL_MS = 250;

const MAX_AT_ONCE = 50;

export class NetworkCalls implements NetworkCallsPort {
  constructor(
    private readonly calls: NetworkCallRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async queue(
    workspaceId: string,
    request: Request,
    expiresAt: Date,
  ): Promise<string> {
    const call = NetworkCall.queue({
      id: NetworkCallId.of(this.ids.generate()),
      workspaceId: WorkspaceId.of(workspaceId),
      request: NetworkRequest.of(request),
      expiresAt,
      now: this.clock.now(),
    });

    await this.calls.add(call);

    return call.id.value;
  }

  async stateOf(callId: string): Promise<NetworkCallState> {
    return this.viewOf(await this.found(callId), this.clock.now());
  }

  async answered(callId: string, until: Date): Promise<NetworkCallState> {
    for (;;) {
      const call = await this.found(callId);
      const now = this.clock.now();
      const state = this.viewOf(call, now);

      if (state.kind === 'answered') {
        return state;
      }

      if (state.kind === 'expired') {
        return this.stateOnceCompleted(call, call.expire(now));
      }

      if (now.getTime() >= until.getTime()) {
        return this.stateOnceCompleted(call, call.cancel(now));
      }

      await this.clock.sleep(POLL_INTERVAL_MS);
    }
  }

  async expireDue(): Promise<number> {
    const now = this.clock.now();
    let expired = 0;

    for (const call of await this.calls.expiringBy(now, MAX_AT_ONCE)) {
      if (await this.saveIfChanged(call, call.expire(now))) {
        expired += 1;
      }
    }

    return expired;
  }

  async purgeCompleted(): Promise<number> {
    const now = this.clock.now();
    let purged = 0;

    for (const call of await this.calls.completedBy(
      NetworkCall.retentionCutoff(now),
      MAX_AT_ONCE,
    )) {
      if (
        call.isPastRetention(now) &&
        (await this.saveIfChanged(call, call.purge(now)))
      ) {
        purged += 1;
      }
    }

    return purged;
  }

  private async found(callId: string): Promise<NetworkCall> {
    const call = await this.calls.find(NetworkCallId.of(callId));

    if (!call) {
      throw new UnknownNetworkCallError(callId);
    }

    return call;
  }

  private viewOf(call: NetworkCall, now: Date): NetworkCallState {
    const { answer } = call;

    if (answer) {
      return {
        kind: 'answered',
        answer: {
          status: answer.status,
          headers: answer.headers,
          body: answer.body,
          ms: answer.ms,
          error: answer.error,
        },
      };
    }

    const state = call.stateAt(now);

    return state === 'waiting' || state === 'claimed'
      ? { kind: 'waiting' }
      : { kind: 'expired' };
  }

  private async stateOnceCompleted(
    call: NetworkCall,
    completed: NetworkCall,
  ): Promise<NetworkCallState> {
    return completed === call || (await this.saveIfChanged(call, completed))
      ? this.viewOf(completed, this.clock.now())
      : this.stateOf(call.id.value);
  }

  private async saveIfChanged(
    call: NetworkCall,
    changed: NetworkCall,
  ): Promise<boolean> {
    if (changed === call) {
      return false;
    }

    try {
      await this.calls.save(changed);
      return true;
    } catch (error) {
      if (error instanceof NetworkCallVersionConflictError) {
        return false;
      }

      throw error;
    }
  }
}
