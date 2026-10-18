import { createHash } from 'node:crypto';
import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import type {
  SpecRead,
  SpecReaderPort,
} from '@integrations/application/ports/spec-reader.port';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { mcpReasonOf } from '@integrations/infrastructure/mcp/mcp-failures';
import type { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { refreshingOnce } from '@integrations/infrastructure/mcp/refreshing-once';
import { mcpOperations } from '@integrations/infrastructure/specs/mcp/mcp-operations';
import { operationsRead } from '@integrations/infrastructure/specs/operations-read';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
  );
};

const hashOf = (spec: ApiSpec, tools: readonly Tool[]): ContentHash =>
  ContentHash.of(
    createHash('sha256')
      .update(JSON.stringify([spec.kind, spec.url, spec.connected]))
      .update('\n')
      .update(
        JSON.stringify(
          canonical(
            [...tools].sort((one, other) => one.name.localeCompare(other.name)),
          ),
        ),
      )
      .digest('hex'),
  );

export class McpSpecReader implements SpecReaderPort {
  constructor(private readonly sessions: McpSessions) {}

  async read(spec: ApiSpec, callAuth: CallAuth): Promise<SpecRead> {
    const server = spec.url;

    if (server === null) {
      throw new InconsistentStateError(
        'API spec',
        'names an MCP server without its url',
      );
    }

    try {
      const tools = await refreshingOnce(
        (token) =>
          this.sessions.tools(server, {
            connection: token?.value ?? null,
            secrets: spec.injectedSecrets.map((each) => each.value),
            credentials: callAuth.credentials,
          }),
        spec.connected ? callAuth.connection : null,
      );

      return {
        kind: 'read',
        hash: hashOf(spec, tools),
        ...operationsRead(mcpOperations(tools)),
      };
    } catch (error) {
      return {
        kind: 'unread',
        problem: `could not be read: ${mcpReasonOf(error, server)}`,
      };
    }
  }
}
