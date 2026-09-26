import { createHash } from 'node:crypto';
import type { HookCallbacksPort } from '@integrations/application/ports/hook-callbacks.port';
import { CAUSE_HEADER } from '@integrations/application/ports/hook-firings.port';
import type {
  HookMoment,
  ListeningHook,
  StepOutcome,
  StepTaken,
  Waiting,
} from '@integrations/application/ports/hook-runtime.port';
import type { HookSigningSecretsPort } from '@integrations/application/ports/hook-signing-secrets.port';
import type { HookTokensPort } from '@integrations/application/ports/hook-tokens.port';
import {
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookSigningIR } from '@integrations/infrastructure/hooks/hook.compile';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { API_PREFIX, HOOK_CALLBACKS } from '@platform/http/routes';
import { signatureOf } from '@platform/outbound/standard-webhooks';
import type {
  NetworkAnswer,
  NetworkCallsPort,
  NetworkRequest,
} from '@work/application/ports/network-calls.port';

type Fetch = typeof globalThis.fetch;

const CALLBACK_LIFE_MS = 15 * 60 * 1000;

const NETWORK_PATIENCE_MS = 2 * 60 * 1000;

const MOST_KEPT = 16 * 1024;

export interface HookRequest {
  readonly hook: ListeningHook;
  readonly moment: HookMoment;
  readonly step: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly fromNetwork: boolean;
  readonly signing: HookSigningIR | null;
  readonly deadline: Date;
  readonly waiting: Waiting;
  readonly resuming: StepOutcome | null;
}

interface Answered {
  readonly status: number;
  readonly response: unknown;
  readonly error: string | null;
}

export interface HookRequestSettings {
  readonly publicUrl: string;
  readonly allowed: readonly string[];
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

const kept = (text: string): unknown => {
  const trimmed = text.slice(0, MOST_KEPT);

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
  let held = 0;

  try {
    while (held < MOST_KEPT) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      held += value.length;
    }
  } catch {
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel().catch(() => {});
  }

  return Buffer.concat(chunks).subarray(0, MOST_KEPT).toString('utf8');
};

const refusalIn = (answered: Answered): string | null => {
  const refuse = (answered.response as { refuse?: unknown } | null)?.refuse;

  return answered.status >= 200 &&
    answered.status < 300 &&
    typeof refuse === 'string' &&
    refuse.trim()
    ? refuse.trim()
    : null;
};

const messageId = (hook: string, occurrence: string, step: string): string =>
  `msg_${createHash('sha256').update(`${hook}\u0000${occurrence}\u0000${step}`).digest('hex').slice(0, 32)}`;

const fromAnswer = (answer: NetworkAnswer): Answered => ({
  status: answer.status,
  response: kept(Buffer.from(answer.body).toString('utf8')),
  error: answer.error,
});

export class HookRequests {
  private readonly policy: OutboundPolicy;

  constructor(
    private readonly settings: HookRequestSettings,
    private readonly secrets: HookSigningSecretsPort,
    private readonly tokens: HookTokensPort,
    private readonly callbacks: HookCallbacksPort,
    private readonly network: NetworkCallsPort,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {
    this.policy = new OutboundPolicy(settings.allowed);
  }

  async sent(request: HookRequest, now: Date): Promise<StepTaken> {
    const started = now;
    const target = new URL(request.url);

    if (target.protocol !== 'https:' && !request.fromNetwork) {
      return this.failedBefore(
        request,
        started,
        'not-allowed',
        `sends to ${target.origin}, which is not https`,
      );
    }

    if (request.resuming?.status === 'waiting') {
      return this.resumed(request, request.resuming, started);
    }

    let headers: Record<string, string>;

    try {
      headers = await this.headers(request, started);
    } catch (error) {
      return this.failedBefore(
        request,
        started,
        'not-allowed',
        described(error),
      );
    }

    if (request.fromNetwork) {
      return this.fromNetwork(request, headers, started);
    }

    try {
      this.policy.allow(request.url);
    } catch (error) {
      return this.failedBefore(
        request,
        started,
        'not-allowed',
        described(error),
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
        status: reply.status,
        response: kept(await firstOf(reply)),
        error: null,
      };
    } catch (error) {
      answered = { status: 0, response: null, error: described(error) };
    }

    return this.taken(request, headers, answered, started, new Date());
  }

  private async headers(
    request: HookRequest,
    at: Date,
  ): Promise<Record<string, string>> {
    const id = messageId(
      request.hook.id,
      request.moment.occurrence,
      request.step,
    );
    const timestamp = Math.floor(at.getTime() / 1000);
    const callback = await this.callbacks.minted(
      {
        workspaceId: request.moment.task.workspaceId,
        taskId: request.moment.task.taskId,
        hook: request.hook.key,
        firing: request.moment.firing,
      },
      new Date(at.getTime() + CALLBACK_LIFE_MS),
    );
    const signed: Record<string, string> = {
      ...request.headers,
      'content-type': 'application/json',
      'user-agent': 'Spotlight-Hooks/1',
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'spotlight-hook': request.hook.key,
      'spotlight-callback-url': `${this.settings.publicUrl}/${API_PREFIX}/${HOOK_CALLBACKS}`,
      'spotlight-callback-token': callback,
      ...(request.moment.firing
        ? { [CAUSE_HEADER]: request.moment.firing }
        : {}),
    };

    if (request.signing?.kind === 'hmac') {
      const secret = await this.secrets.signingSecretOf(request.hook.id);

      if (!secret) {
        throw new Error(
          'has no secret to sign with, so nothing was sent; give the hook a new secret with a higher secretVersion',
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
        subject: `hook:${request.moment.task.workspaceId}/${request.hook.teamId}/${request.hook.key}`,
        occurrence: request.moment.occurrence,
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
  ): Promise<StepTaken> {
    const patience =
      request.waiting === 'until-answered'
        ? request.deadline
        : new Date(started.getTime() + NETWORK_PATIENCE_MS);
    const asked: NetworkRequest = {
      method: 'POST',
      url: request.url,
      headers,
      body: new TextEncoder().encode(request.body),
      timeoutMs: Math.max(
        Math.min(
          request.deadline.getTime() - started.getTime(),
          patience.getTime() - started.getTime(),
        ),
        1_000,
      ),
    };
    const call = await this.network.queue(
      request.moment.task.workspaceId,
      asked,
      patience,
    );

    if (request.waiting === 'hand-back') {
      return {
        outcome: {
          name: request.step,
          status: 'waiting',
          call,
          until: patience.toISOString(),
        },
        refusal: null,
        trace: null,
      };
    }

    const state = await this.network.answered(call, patience);

    return state.kind === 'answered'
      ? this.taken(
          request,
          headers,
          fromAnswer(state.answer),
          started,
          new Date(),
        )
      : this.taken(
          request,
          headers,
          {
            status: 0,
            response: null,
            error: 'no host of the workspace answered in time',
          },
          started,
          new Date(),
        );
  }

  private async resumed(
    request: HookRequest,
    waiting: Extract<StepOutcome, { status: 'waiting' }>,
    now: Date,
  ): Promise<StepTaken> {
    const state = await this.network.stateOf(waiting.call);

    if (state.kind === 'waiting' && new Date(waiting.until) > now) {
      return { outcome: waiting, refusal: null, trace: null };
    }

    const answered: Answered =
      state.kind === 'answered'
        ? fromAnswer(state.answer)
        : {
            status: 0,
            response: null,
            error: 'no host of the workspace answered in time',
          };
    const ms = state.kind === 'answered' ? state.answer.ms : 0;

    return this.taken(request, {}, answered, new Date(now.getTime() - ms), now);
  }

  private taken(
    request: HookRequest,
    headers: Record<string, string>,
    answered: Answered,
    started: Date,
    ended: Date,
  ): StepTaken {
    const ok = answered.status >= 200 && answered.status < 300;
    const reason = answered.error
      ? `could not reach ${request.url}: ${answered.error}`
      : `was answered ${answered.status} by ${request.url}`;
    const shown = Object.fromEntries(
      Object.entries(headers).filter(
        ([name]) =>
          name !== 'spotlight-callback-token' &&
          name !== 'authorization' &&
          name !== 'webhook-signature',
      ),
    );

    return {
      outcome: ok
        ? { name: request.step, status: 'done', output: answered.response }
        : {
            name: request.step,
            status: 'failed',
            code:
              answered.status === 0
                ? 'unreachable'
                : HookFailure.answered(answered.status, reason).code,
            reason,
            output: answered.response,
          },
      refusal: refusalIn(answered),
      trace: {
        hook: request.hook.key,
        step: request.step,
        kind: 'request',
        target: request.url,
        request: { headers: shown, body: kept(request.body) },
        response: answered.error ?? answered.response,
        status: answered.status === 0 ? null : answered.status,
        failed: !ok,
        startedAt: started,
        ms: Math.max(ended.getTime() - started.getTime(), 0),
      },
    };
  }

  private failedBefore(
    request: HookRequest,
    started: Date,
    code: HookFailureCode,
    reason: string,
  ): StepTaken {
    return {
      outcome: {
        name: request.step,
        status: 'failed',
        code,
        reason,
        output: null,
      },
      refusal: null,
      trace: {
        hook: request.hook.key,
        step: request.step,
        kind: 'request',
        target: request.url,
        request: { body: kept(request.body) },
        response: reason,
        status: null,
        failed: true,
        startedAt: started,
        ms: 0,
      },
    };
  }
}
