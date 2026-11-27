import { OutboundLimitReachedError } from '@integrations/application/errors/outbound-limit-reached.error';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { attempted } from '@integrations/infrastructure/integrations/call-attempts';
import {
  McpUnauthorizedError,
  mcpFailureOf,
} from '@integrations/infrastructure/mcp/mcp-failures';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { describe, expect, it } from 'vitest';

const SERVER = 'https://mcp.example.com/mcp';

const failureOf = async (error: unknown): Promise<HookFailure> => {
  const attempt = await attempted(async () => {
    throw mcpFailureOf('using search_issues', SERVER, error);
  }, 1_000);

  if (attempt.kind !== 'failed') {
    throw new Error(`expected a failed attempt, got ${attempt.kind}`);
  }

  return HookFailure.callFailed(attempt.fact);
};

describe('mcpFailureOf', () => {
  it('ends the call at once when the server answers with a JSON-RPC error', async () => {
    const failure = await failureOf(
      new McpError(ErrorCode.InvalidParams, 'query is required'),
    );

    expect(failure.code).toBe('tool-failed');
    expect(failure.retry.nextAttemptAt(1, new Date())).toBeNull();
  });

  it('ends the call at once when the failure is not known', async () => {
    expect((await failureOf(new TypeError('x is not a function'))).code).toBe(
      'tool-failed',
    );
  });

  it('tries again when the server could not be reached', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    });

    expect((await failureOf(refused)).code).toBe('unreachable');
    expect(
      (await failureOf(new McpError(ErrorCode.ConnectionClosed, 'closed')))
        .code,
    ).toBe('unreachable');
  });

  it('reads the status the server answered with', async () => {
    expect((await failureOf(new StreamableHTTPError(503, 'busy'))).code).toBe(
      'server-error',
    );
    expect(
      (await failureOf(new StreamableHTTPError(429, 'slow down'))).code,
    ).toBe('throttled');
    expect((await failureOf(new McpUnauthorizedError(SERVER))).code).toBe(
      'rejected',
    );
  });

  it('keeps a failure that is already classified', () => {
    const upstream = new UpstreamError('reaching mcp.example.com', 'reset');

    expect(mcpFailureOf('using search_issues', SERVER, upstream)).toBe(
      upstream,
    );
  });

  it('throttles a call over the workspace outbound limit', async () => {
    const attempt = await attempted(async () => {
      throw new OutboundLimitReachedError(20);
    }, 1_000);

    expect(
      attempt.kind === 'failed' && HookFailure.callFailed(attempt.fact).code,
    ).toBe('throttled');
  });
});
