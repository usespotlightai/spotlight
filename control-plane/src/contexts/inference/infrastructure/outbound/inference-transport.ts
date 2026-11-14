import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import type {
  InferenceTransportPort,
  ProbedEndpoint,
  ProbeResult,
} from '@inference/application/ports/inference-transport.port';
import {
  JsonSchema,
  ModelEmptyCompletionError,
  type ModelEndpoint,
  ModelRequestError,
  requestJson,
} from '@platform/llm/chat-completions';
import {
  OutboundBlockedError,
  type OutboundGuard,
} from '@platform/outbound/outbound-guard';
import type {
  JsonRequest,
  StructuredCompletion,
} from '@shared-kernel/application/ports/inference-calls.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { z } from 'zod';

const REQUESTS = 'spotlight.inference.requests';

const OUTCOME = 'spotlight.inference.outcome';

const PROBE_WITHIN_MS = 30_000;

const PROBE = new JsonSchema('probe', z.object({ ok: z.boolean() }));

const UNAUTHORIZED = new Set([401, 403]);

type Outcome =
  | 'ok'
  | 'unauthorized'
  | 'insufficient_credits'
  | 'blocked'
  | 'error';

const outcomeOf = (error: unknown, blocked: boolean): Outcome => {
  if (blocked) {
    return 'blocked';
  }

  if (error instanceof ModelEmptyCompletionError) {
    return 'ok';
  }

  if (error instanceof ModelRequestError) {
    if (error.insufficientCredits) {
      return 'insufficient_credits';
    }

    return error.status !== null && UNAUTHORIZED.has(error.status)
      ? 'unauthorized'
      : 'error';
  }

  return 'error';
};

const hostOf = (baseUrl: string): string => {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'unknown';
  }
};

const messageOf = (error: unknown, blockedReason: string | null): string => {
  if (blockedReason) {
    return blockedReason;
  }

  if (error instanceof ModelRequestError) {
    if (error.insufficientCredits) {
      return 'The endpoint reports insufficient credits. Add credits and try again.';
    }

    if (error.status !== null && UNAUTHORIZED.has(error.status)) {
      return `The endpoint refused the API key (${error.status}). Check the key.`;
    }

    if (error.status === 404) {
      return 'The endpoint did not find the model or the path (404). Check the base URL and the model.';
    }

    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
};

export class InferenceTransport implements InferenceTransportPort {
  constructor(
    private readonly scope: WorkspaceOutboundScopePort,
    private readonly guard: OutboundGuard,
    private readonly telemetry: TelemetryPort,
    private readonly logger: LoggerPort,
  ) {}

  async refusalOf(
    workspaceId: string,
    baseUrl: string,
  ): Promise<string | null> {
    try {
      await this.scope.within(WorkspaceId.of(workspaceId), async () =>
        this.guard.check(baseUrl),
      );

      return null;
    } catch (error) {
      if (error instanceof OutboundBlockedError) {
        return error.reason;
      }

      throw error;
    }
  }

  async call<T>(
    workspaceId: string,
    endpoint: ModelEndpoint,
    request: JsonRequest<T>,
  ): Promise<StructuredCompletion<T>> {
    const attempt = await this.attempt(workspaceId, (fetch) =>
      requestJson({ ...request, endpoint, fetch }),
    );

    this.telemetry.count(REQUESTS, { [OUTCOME]: attempt.outcome });

    if (attempt.failed) {
      if (attempt.outcome !== 'ok') {
        this.logger.warn(
          {
            workspaceId,
            host: hostOf(endpoint.baseUrl),
            status:
              attempt.error instanceof ModelRequestError
                ? attempt.error.status
                : null,
            outcome: attempt.outcome,
          },
          'An inference request failed',
        );
      }

      throw attempt.error;
    }

    return attempt.value;
  }

  async probe(
    workspaceId: string,
    endpoint: ProbedEndpoint,
  ): Promise<ProbeResult> {
    const attempt = await this.attempt(workspaceId, (fetch) =>
      requestJson({
        endpoint,
        fetch,
        responseSchema: PROBE,
        system: 'Answer with JSON.',
        prompt: 'Say ok.',
        maxTokens: 1,
        timeoutMs: PROBE_WITHIN_MS,
      }),
    );

    if (!attempt.failed || attempt.error instanceof ModelEmptyCompletionError) {
      return { ok: true, message: 'The endpoint answered.' };
    }

    return {
      ok: false,
      message: messageOf(attempt.error, attempt.blockedReason),
    };
  }

  private async attempt<T>(
    workspaceId: string,
    work: (fetch: typeof globalThis.fetch) => Promise<T>,
  ): Promise<
    | { failed: false; outcome: 'ok'; value: T }
    | {
        failed: true;
        outcome: Outcome;
        error: unknown;
        blockedReason: string | null;
      }
  > {
    let blockedReason: string | null = null;
    const fetch: typeof globalThis.fetch = async (url, init) => {
      try {
        return await this.guard.fetch(url, init);
      } catch (error) {
        if (error instanceof OutboundBlockedError) {
          blockedReason = error.reason;
        }

        throw error;
      }
    };

    try {
      const value = await this.scope.within(WorkspaceId.of(workspaceId), () =>
        work(fetch),
      );

      return { failed: false, outcome: 'ok', value };
    } catch (error) {
      return {
        failed: true,
        outcome: outcomeOf(error, blockedReason !== null),
        error,
        blockedReason,
      };
    }
  }
}
