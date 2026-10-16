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

const MOST_AT_ONCE = 50;

export class NetworkCalls implements NetworkCallsPort {
  constructor(
    private readonly calls: NetworkCallRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async queue(
    workspaceId: string,
    request: Request,
    lapsesAt: Date,
  ): Promise<string> {
    const call = NetworkCall.queue({
      id: NetworkCallId.of(this.ids.generate()),
      workspaceId: WorkspaceId.of(workspaceId),
      request: NetworkRequest.of(request),
      lapsesAt,
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

      if (state.kind === 'lapsed') {
        return this.settled(call, call.lapsed(now));
      }

      if (now.getTime() >= until.getTime()) {
        return this.settled(call, call.givenUp(now));
      }

      await this.clock.sleep(POLL_INTERVAL_MS);
    }
  }

  async lapseOverdue(): Promise<number> {
    const now = this.clock.now();
    let lapsed = 0;

    for (const call of await this.calls.lapsingBy(now, MOST_AT_ONCE)) {
      if (await this.settledAs(call, call.lapsed(now))) {
        lapsed += 1;
      }
    }

    return lapsed;
  }

  async forgetSettled(): Promise<number> {
    const now = this.clock.now();
    let forgotten = 0;

    for (const call of await this.calls.settledBy(
      NetworkCall.settledForgettablyBy(now),
      MOST_AT_ONCE,
    )) {
      if (
        call.isForgettableAt(now) &&
        (await this.settledAs(call, call.forgotten(now)))
      ) {
        forgotten += 1;
      }
    }

    return forgotten;
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

    const standing = call.stateAt(now);

    return standing === 'waiting' || standing === 'claimed'
      ? { kind: 'waiting' }
      : { kind: 'lapsed' };
  }

  private async settled(
    call: NetworkCall,
    settled: NetworkCall,
  ): Promise<NetworkCallState> {
    return settled === call || (await this.settledAs(call, settled))
      ? this.viewOf(settled, this.clock.now())
      : this.stateOf(call.id.value);
  }

  private async settledAs(
    call: NetworkCall,
    settled: NetworkCall,
  ): Promise<boolean> {
    if (settled === call) {
      return false;
    }

    try {
      await this.calls.save(settled);
      return true;
    } catch (error) {
      if (error instanceof NetworkCallVersionConflictError) {
        return false;
      }

      throw error;
    }
  }
}
