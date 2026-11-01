import {
  OutboundBlockedError,
  type OutboundGuard,
} from '@platform/outbound/outbound-guard';
import { signatureOf } from '@platform/outbound/standard-webhooks';
import type {
  ProvisionAnswer,
  ProvisionCall,
  ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';

type Fetch = typeof globalThis.fetch;

const TIMEOUT_MS = 10_000;

const MAX_DETAIL = 500;

export interface ProvisionSettings {
  readonly spotlightUrl: string;
  readonly guard: OutboundGuard;
}

const bodyOf = (call: ProvisionCall, spotlightUrl: string): string =>
  JSON.stringify({
    type: 'work.provision',
    timestamp: call.at.toISOString(),
    data: {
      kind: call.kind,
      runId: call.runId,
      stackId: call.stackId,
      taskId: call.taskId,
      workspaceId: call.workspaceId,
      pool: call.pool,
      labels: call.labels,
      image: call.image,
      runner: {
        id: call.runnerId,
        token: call.token,
        egress: call.egress
          ? {
              url: call.egress.url,
              credential: call.egress.credential,
              traffic: call.egress.traffic,
            }
          : null,
      },
      spotlightUrl,
      claimBy: call.claimBy.toISOString(),
    },
  });

const described = (error: unknown): string => {
  const cause = (error as { cause?: unknown }).cause;

  return error instanceof Error
    ? cause instanceof Error
      ? `${error.message}: ${cause.message || (cause as { code?: string }).code || cause.name}`
      : error.message
    : String(error);
};

export class SignedProvisionCalls implements ProvisionCallsPort {
  constructor(
    private readonly settings: ProvisionSettings,
    private readonly fetch: Fetch = settings.guard.fetch,
  ) {}

  async call(call: ProvisionCall): Promise<ProvisionAnswer> {
    try {
      this.settings.guard.check(call.url.value);
    } catch {
      return {
        outcome: 'not-allowed',
        detail: `This deployment’s outbound allow-list doesn’t include ${call.url.hostname}.`,
      };
    }

    const timestamp = Math.floor(call.at.getTime() / 1000);
    const body = bodyOf(call, this.settings.spotlightUrl);

    let answered: Response;

    try {
      answered = await this.fetch(call.url.value, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': call.messageId,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': signatureOf(
            call.secret.key,
            call.messageId,
            timestamp,
            body,
          ),
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof OutboundBlockedError) {
        return { outcome: 'not-allowed', detail: error.message };
      }

      return { outcome: 'unreachable', detail: described(error) };
    }

    const response = (await answered.text().catch(() => '')).slice(
      0,
      MAX_DETAIL,
    );

    if (answered.status >= 200 && answered.status < 300) {
      return { outcome: 'accepted' };
    }

    return {
      outcome: 'http-error',
      detail: `Provision URL answered ${answered.status}.${response ? ` Response: ${response}` : ''}`,
    };
  }
}
