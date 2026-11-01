import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { RequestIR } from '@integrations/infrastructure/integrations/integration.compile';
import {
  answeredWith,
  type HttpOutbound,
  type OutboundResult,
  parsed,
} from '@integrations/infrastructure/outbound/http-outbound';
import type { CelVariables } from '@platform/expressions/cel-variables';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type { NetworkCallsPort } from '@work/application/ports/network-calls.port';

export class NetworkOutbound {
  constructor(
    private readonly outbound: HttpOutbound,
    private readonly calls: NetworkCallsPort,
    private readonly clock: ClockPort,
  ) {}

  async run(
    request: RequestIR,
    against: CelVariables,
    credentials: Credentials,
    workspaceId: string,
    timeoutMs: number,
  ): Promise<OutboundResult> {
    const plain = this.outbound.rendered(request, against);

    if (!plain) {
      return { ok: false, status: 0, response: null, capture: {} };
    }

    const url = new URL(plain.url);
    const headers = { ...plain.headers };
    const secrets =
      request.auth?.kind === 'secrets' ? request.auth.secrets : [];

    if (secrets.length > 0) {
      (await credentials.standInsFor(url.href, secrets)).applyTo({
        url,
        headers,
      });
    }

    const sending = `sending a request to ${url.host} from the workspace’s network`;

    if (Object.keys(headers).some((name) => name.toLowerCase() === 'host')) {
      throw new UpstreamError(
        sending,
        'the action sets a Host header, so Spotlight didn’t queue it',
        null,
        false,
      );
    }

    const until = new Date(this.clock.now().getTime() + timeoutMs);
    const call = await this.calls.queue(
      workspaceId,
      {
        method: plain.method,
        url: url.href,
        headers,
        body: new TextEncoder().encode(plain.body ?? ''),
        timeoutMs,
        secrets,
      },
      until,
    );
    const state = await this.calls.answered(call, until);

    if (state.kind !== 'answered') {
      throw new UpstreamError(
        sending,
        state.kind === 'expired' && state.claimed
          ? `a host claimed it but didn’t answer within ${timeoutMs / 1_000} seconds`
          : `no host of the workspace sent it within ${timeoutMs / 1_000} seconds`,
      );
    }

    const { response } = state;

    if (response.status === 0 || response.error) {
      throw new UpstreamError(
        sending,
        response.error ?? 'nothing answered there',
      );
    }

    return answeredWith(
      request,
      against,
      response.status,
      parsed(new TextDecoder().decode(response.body)),
    );
  }
}
