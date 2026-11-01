import { createHash } from 'node:crypto';
import { CAUSE_HEADER } from '@integrations/application/ports/hook-firing-history.port';
import type {
  HookEventInstance,
  ListeningHook,
  StepOutcome,
  StepResult,
  WaitMode,
} from '@integrations/application/ports/hook-runtime.port';
import type { HookSigningSecretsPort } from '@integrations/application/ports/hook-signing-secrets.port';
import type { HookTokensPort } from '@integrations/application/ports/hook-tokens.port';
import type { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { HookReply } from '@integrations/domain/value-objects/hook-reply.vo';
import type { HookSigningIR } from '@integrations/infrastructure/hooks/hook.compile';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { API_PREFIX, HOOK_CALLBACKS } from '@platform/http/routes';
import { signatureOf } from '@platform/outbound/standard-webhooks';
import type {
  NetworkCallsPort,
  NetworkRequest,
  NetworkResponse,
} from '@work/application/ports/network-calls.port';

type Fetch = typeof globalThis.fetch;

const NETWORK_TIMEOUT_MS = 2 * 60 * 1000;

const MAX_STORED_BYTES = 16 * 1024;

export interface HookRequest {
  readonly hook: ListeningHook;
  readonly instance: HookEventInstance;
  readonly step: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly fromNetwork: boolean;
  readonly signing: HookSigningIR | null;
  readonly deadline: Date;
  readonly waitMode: WaitMode;
  readonly resuming: StepOutcome | null;
}

interface Answered {
  readonly reply: HookReply;
  readonly error: string | null;
}

export interface HookRequestSettings {
  readonly publicUrl: string;
  readonly policy: OutboundPolicy;
}

const PLAINLY: Readonly<Record<string, string>> = {
  ECONNREFUSED: 'nothing answered there',
  ECONNRESET: 'the connection was cut off',
  ENOTFOUND: 'the host does not resolve',
  EAI_AGAIN: 'the host does not resolve',
  ETIMEDOUT: 'the connection timed out',
  CERT_HAS_EXPIRED: 'its certificate has expired',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'its certificate is not trusted',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'its certificate is not trusted',
};

const described = (error: unknown): string => {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'it did not answer in time';
  }

  const cause = (error as { cause?: unknown }).cause;
  const code = (cause as { code?: string } | undefined)?.code;

  if (code && PLAINLY[code]) {
    return PLAINLY[code];
  }

  return error instanceof Error
    ? cause instanceof Error
      ? `${error.message}: ${cause.message || code || cause.name}`
      : error.message
    : String(error);
};

const storedBody = (text: string): unknown => {
  const trimmed = text.slice(0, MAX_STORED_BYTES);

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const firstOf = async (reply: Response): Promise<string> => {
  const reader = reply.body?.getReader();

  if (!reader) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (size < MAX_STORED_BYTES) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      size += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return Buffer.concat(chunks).subarray(0, MAX_STORED_BYTES).toString('utf8');
};

const UNANSWERED = (error: string): Answered => ({
  reply: HookReply.unanswered(),
  error,
});

const messageId = (hook: string, occurrence: string, step: string): string =>
  `msg_${createHash('sha256').update(`${hook}\u0000${occurrence}\u0000${step}`).digest('hex').slice(0, 32)}`;

const fromResponse = (response: NetworkResponse): Answered =>
  response.status === 0
    ? UNANSWERED(response.error ?? 'nothing answered there')
    : {
        reply: HookReply.answered(
          response.status,
          storedBody(Buffer.from(response.body).toString('utf8')),
        ),
        error: response.error,
      };

export class HookRequests {
  private readonly policy: OutboundPolicy;

  constructor(
    private readonly settings: HookRequestSettings,
    private readonly secrets: HookSigningSecretsPort,
    private readonly tokens: HookTokensPort,
    private readonly callbacks: HookCallbackTokens,
    private readonly network: NetworkCallsPort,
    private readonly fetch: Fetch = settings.policy.fetch,
  ) {
    this.policy = settings.policy;
  }

  async sent(request: HookRequest, now: Date): Promise<StepResult> {
    const started = now;

    if (request.resuming?.status === 'waiting') {
      return this.resumed(request, request.resuming, started);
    }

    let headers: Record<string, string>;

    try {
      headers = await this.headers(request, started);
    } catch (error) {
      return this.notSent(
        request,
        HookFailure.of('not-allowed', described(error)),
        started,
      );
    }

    if (request.fromNetwork) {
      return this.fromNetwork(request, headers, started);
    }

    try {
      this.policy.allow(request.url);
    } catch (error) {
      return this.notSent(
        request,
        HookFailure.of('not-allowed', described(error)),
        started,
      );
    }

    let answered: Answered;

    try {
      const reply = await this.fetch(request.url, {
        method: 'POST',
        headers,
        body: request.body,
        redirect: 'manual',
        signal: AbortSignal.timeout(
          Math.max(request.deadline.getTime() - started.getTime(), 1),
        ),
      });

      answered = {
        reply: HookReply.answered(
          reply.status,
          storedBody(await firstOf(reply)),
        ),
        error: null,
      };
    } catch (error) {
      answered = UNANSWERED(described(error));
    }

    return this.resultOf(request, headers, answered, started, new Date());
  }

  private async headers(
    request: HookRequest,
    at: Date,
  ): Promise<Record<string, string>> {
    const id = messageId(
      request.hook.id,
      request.instance.occurrence,
      request.step,
    );
    const timestamp = Math.floor(at.getTime() / 1000);
    const callback = await this.callbacks.issued({
      workspaceId: request.instance.task.workspaceId,
      taskId: request.instance.task.taskId,
      hook: request.hook.key,
      firing: request.instance.firing,
    });
    const signed: Record<string, string> = {
      ...request.headers,
      'content-type': 'application/json',
      'user-agent': 'Spotlight-Hooks/1',
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'spotlight-hook': request.hook.key,
      'spotlight-callback-url': `${this.settings.publicUrl}/${API_PREFIX}/${HOOK_CALLBACKS}`,
      'spotlight-callback-token': callback,
      ...(request.instance.firing
        ? { [CAUSE_HEADER]: request.instance.firing }
        : {}),
    };

    if (request.signing?.kind === 'hmac') {
      const secret = await this.secrets.signingSecretOf(request.hook.id);

      if (!secret) {
        throw new Error(
          'has no secret to sign with. Spotlight sent nothing. Please set a new secret for the hook with a higher secretVersion',
        );
      }

      signed['webhook-signature'] = signatureOf(
        secret.key,
        id,
        timestamp,
        request.body,
      );
    }

    if (request.signing?.kind === 'oidc') {
      signed.authorization = `Bearer ${await this.tokens.signed({
        audience: request.signing.audience,
        subject: `hook:${request.instance.task.workspaceId}/${request.hook.teamId}/${request.hook.key}`,
        occurrence: request.instance.occurrence,
        message: id,
        bodyDigest: createHash('sha256')
          .update(request.body)
          .digest('base64url'),
      })}`;
    }

    return signed;
  }

  private async fromNetwork(
    request: HookRequest,
    headers: Record<string, string>,
    started: Date,
  ): Promise<StepResult> {
    const timeout =
      request.waitMode === 'wait'
        ? request.deadline
        : new Date(started.getTime() + NETWORK_TIMEOUT_MS);
    const networkRequest: NetworkRequest = {
      method: 'POST',
      url: request.url,
      headers,
      body: new TextEncoder().encode(request.body),
      timeoutMs: Math.max(
        Math.min(
          request.deadline.getTime() - started.getTime(),
          timeout.getTime() - started.getTime(),
        ),
        1_000,
      ),
    };
    const call = await this.network.queue(
      request.instance.task.workspaceId,
      networkRequest,
      timeout,
    );

    if (request.waitMode === 'suspend') {
      return {
        outcome: {
          name: request.step,
          status: 'waiting',
          call,
          until: timeout.toISOString(),
        },
        denyReason: null,
        trace: null,
      };
    }

    const state = await this.network.answered(call, timeout);

    return state.kind === 'answered'
      ? this.resultOf(
          request,
          headers,
          fromResponse(state.response),
          started,
          new Date(),
        )
      : this.resultOf(
          request,
          headers,
          UNANSWERED('no host of the workspace answered in time'),
          started,
          new Date(),
        );
  }

  private async resumed(
    request: HookRequest,
    waiting: Extract<StepOutcome, { status: 'waiting' }>,
    now: Date,
  ): Promise<StepResult> {
    const state = await this.network.stateOf(waiting.call);

    if (state.kind === 'waiting' && new Date(waiting.until) > now) {
      return { outcome: waiting, denyReason: null, trace: null };
    }

    const answered: Answered =
      state.kind === 'answered'
        ? fromResponse(state.response)
        : UNANSWERED('no host of the workspace answered in time');
    const ms = state.kind === 'answered' ? state.response.ms : 0;

    return this.resultOf(
      request,
      {},
      answered,
      new Date(now.getTime() - ms),
      now,
    );
  }

  private resultOf(
    request: HookRequest,
    headers: Record<string, string>,
    answered: Answered,
    started: Date,
    ended: Date,
  ): StepResult {
    const { reply } = answered;
    const reason = answered.error
      ? `could not reach ${request.url}: ${answered.error}`
      : `was answered ${reply.status} by ${request.url}`;
    const failure = reply.failure(reason);
    const shown = Object.fromEntries(
      Object.entries(headers).filter(
        ([name]) =>
          name !== 'spotlight-callback-token' &&
          name !== 'authorization' &&
          name !== 'webhook-signature',
      ),
    );

    return {
      outcome:
        failure === null
          ? { name: request.step, status: 'done', output: reply.body }
          : {
              name: request.step,
              status: 'failed',
              code: failure.code,
              reason,
              output: reply.body,
            },
      denyReason: reply.denyReason,
      trace: {
        hook: request.hook.key,
        step: request.step,
        kind: 'request',
        target: request.url,
        request: { headers: shown, body: storedBody(request.body) },
        response: answered.error ?? reply.body,
        status: reply.status,
        failed: failure !== null,
        startedAt: started,
        ms: Math.max(ended.getTime() - started.getTime(), 0),
      },
    };
  }

  notSent(
    request: HookRequest,
    failure: HookFailure,
    started: Date,
  ): StepResult {
    return {
      outcome: {
        name: request.step,
        status: 'failed',
        code: failure.code,
        reason: failure.reason,
        output: null,
      },
      denyReason: null,
      trace: {
        hook: request.hook.key,
        step: request.step,
        kind: 'request',
        target: request.url,
        request: { body: storedBody(request.body) },
        response: failure.reason,
        status: null,
        failed: true,
        startedAt: started,
        ms: 0,
      },
    };
  }
}
