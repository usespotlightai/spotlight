import { OutboundHosts } from '@platform/outbound/outbound-hosts';
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
  readonly hosts: OutboundHosts;
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
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async call(call: ProvisionCall): Promise<ProvisionAnswer> {
    if (!this.settings.hosts.allow(call.url.hostname)) {
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
          'webhook-id': call.attempt,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': signatureOf(
            call.secret.key,
            call.attempt,
            timestamp,
            body,
          ),
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
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
