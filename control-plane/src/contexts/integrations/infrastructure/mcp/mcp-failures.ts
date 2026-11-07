import { EgressBlockedError } from '@integrations/application/errors/egress-blocked.error';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';

export class McpUnauthorizedError extends Error {
  constructor(readonly server: string) {
    super(`${new URL(server).host} answered 401`);
    this.name = 'McpUnauthorizedError';
  }
}

export class McpQuestionUnsupportedError extends Error {
  constructor() {
    super('the MCP server asked a question in the middle of the call');
    this.name = 'McpQuestionUnsupportedError';
  }
}

const UNAUTHORIZED = 401;

const TRANSPORT_ERROR_CODES: ReadonlySet<number> = new Set([
  ErrorCode.ConnectionClosed,
  ErrorCode.RequestTimeout,
]);

const NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CLOSED',
]);

const SESSION_GONE = 404;

const codeOf = (error: unknown): string => {
  const cause = (error as { cause?: unknown } | null)?.cause ?? error;
  const code = (cause as { code?: unknown } | null)?.code;

  return typeof code === 'string'
    ? code
    : cause instanceof Error
      ? cause.message
      : String(cause);
};

export const isUnauthorized = (error: unknown): boolean =>
  error instanceof StreamableHTTPError && error.code === UNAUTHORIZED;

export const sessionGone = (error: unknown): boolean =>
  error instanceof StreamableHTTPError && error.code === SESSION_GONE;

export const mcpReasonOf = (error: unknown, server: string): string => {
  const host = new URL(server).host;

  if (error instanceof StreamableHTTPError) {
    return `${host} answered ${error.code ?? 'without a status'}`;
  }

  if (error instanceof McpError) {
    return `${host} answered: ${error.message}`;
  }

  if (
    error instanceof McpUnauthorizedError ||
    error instanceof McpQuestionUnsupportedError ||
    error instanceof EgressBlockedError
  ) {
    return error.message;
  }

  return `${host}: ${codeOf(error)}`;
};

const failedInTransport = (error: unknown): boolean => {
  if (error instanceof McpError) {
    return TRANSPORT_ERROR_CODES.has(error.code);
  }

  const cause = (error as { cause?: unknown } | null)?.cause ?? error;
  const code = (cause as { code?: unknown } | null)?.code;

  return typeof code === 'string' && NETWORK_ERROR_CODES.has(code);
};

const TRANSIENT = true;

const PERMANENT = false;

export const mcpFailureOf = (
  operation: string,
  server: string,
  error: unknown,
): Error => {
  if (error instanceof UpstreamError || error instanceof EgressBlockedError) {
    return error;
  }

  const reason = mcpReasonOf(error, server);

  if (error instanceof McpUnauthorizedError) {
    return new UpstreamError(operation, reason, UNAUTHORIZED, TRANSIENT);
  }

  if (error instanceof StreamableHTTPError) {
    return new UpstreamError(operation, reason, error.code ?? null, TRANSIENT);
  }

  return new UpstreamError(
    operation,
    reason,
    null,
    failedInTransport(error) ? TRANSIENT : PERMANENT,
  );
};
