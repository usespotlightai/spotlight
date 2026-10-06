import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

export class McpAuthorizationRefused extends Error {
  constructor(readonly server: string) {
    super(`${new URL(server).host} answered 401`);
    this.name = 'McpAuthorizationRefused';
  }
}

export class McpQuestionRefused extends Error {
  constructor() {
    super('the MCP server asked a question in the middle of the call');
    this.name = 'McpQuestionRefused';
  }
}

const UNAUTHORIZED = 401;

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

export const refusedAuthorization = (error: unknown): boolean =>
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
    error instanceof McpAuthorizationRefused ||
    error instanceof McpQuestionRefused ||
    error instanceof OutboundRefusedError
  ) {
    return error.message;
  }

  return `${host}: ${codeOf(error)}`;
};
