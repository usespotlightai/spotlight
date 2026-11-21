import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import { failureOf } from '@platform/outbound/outbound-failure';
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
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type Fetch = typeof globalThis.fetch;

const TIMEOUT_MS = 10_000;

const MAX_DETAIL = 500;

const UNPROCESSABLE = 422;

const TOO_MANY_REQUESTS = 429;

// A 422 declines the work only when its body is {"type": "work.declined", "reason": "<text>"}. Another 422 stays an HTTP error, so older provision endpoints keep their retries.
const declinedReason = (text: string): string | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const { type, reason } = parsed as { type?: unknown; reason?: unknown };

  if (type !== 'work.declined' || typeof reason !== 'string') {
    return null;
  }

  return reason.trim().slice(0, MAX_DETAIL) || null;
};

export interface ProvisionSettings {
  readonly spotlightUrl: string;
  readonly guard: OutboundGuard;
  readonly scope: WorkspaceOutboundScopePort;
}

const bodyOf = (call: ProvisionCall, spotlightUrl: string): string =>
  JSON.stringify({
    type: 'work.provision',
    timestamp: call.at.toISOString(),
    data: {
      ...call.tags,
      kind: call.work.kind,
      runId: call.work.kind === 'diff' ? null : call.work.runId,
      stackId: call.work.kind === 'check' ? call.work.stackId : null,
      diffId: call.work.kind === 'diff' ? call.work.diffId : null,
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

export class SignedProvisionCalls implements ProvisionCallsPort {
  constructor(
    private readonly settings: ProvisionSettings,
    private readonly fetch: Fetch = settings.guard.fetch,
  ) {}

  // A call to a provisioner of the deployment goes out under the deployment's allow-list only. A call to a provisioner of a workspace goes out under the workspace's list too.
  call(call: ProvisionCall): Promise<ProvisionAnswer> {
    if (call.owner === 'deployment') {
      return this.callInScope(call);
    }

    return this.settings.scope.within(WorkspaceId.of(call.workspaceId), () =>
      this.callInScope(call),
    );
  }

  private async callInScope(call: ProvisionCall): Promise<ProvisionAnswer> {
    try {
      this.settings.guard.check(call.url.value);
    } catch (error) {
      return {
        outcome: 'not-allowed',
        detail:
          error instanceof OutboundBlockedError && error.scoped
            ? `This workspace’s outbound allow-list doesn’t include ${call.url.hostname}.`
            : `This deployment’s outbound allow-list doesn’t include ${call.url.hostname}.`,
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

      return { outcome: 'unreachable', detail: failureOf(error) };
    }

    const text = await answered.text().catch(() => '');
    const response = text.slice(0, MAX_DETAIL);

    if (answered.status >= 200 && answered.status < 300) {
      return { outcome: 'accepted' };
    }

    if (answered.status === TOO_MANY_REQUESTS) {
      return { outcome: 'full' };
    }

    const reason =
      answered.status === UNPROCESSABLE ? declinedReason(text) : null;

    if (reason) {
      return { outcome: 'declined', detail: reason };
    }

    return {
      outcome: 'http-error',
      detail: `Provision URL answered ${answered.status}.${response ? ` Response: ${response}` : ''}`,
    };
  }
}
