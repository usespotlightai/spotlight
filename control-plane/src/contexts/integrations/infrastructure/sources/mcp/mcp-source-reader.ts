import { createHash } from 'node:crypto';
import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import type {
  SourceRead,
  SourceReaderPort,
} from '@integrations/application/ports/source-reader.port';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { mcpReasonOf } from '@integrations/infrastructure/mcp/mcp-failures';
import type { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { renewingOnce } from '@integrations/infrastructure/mcp/renewing-once';
import { mcpOperations } from '@integrations/infrastructure/sources/mcp/mcp-operations';
import { operationsRead } from '@integrations/infrastructure/sources/operations-read';
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

const hashOf = (source: DescribedSource, tools: readonly Tool[]): ContentHash =>
  ContentHash.of(
    createHash('sha256')
      .update(JSON.stringify([source.kind, source.url, source.connected]))
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

export class McpSourceReader implements SourceReaderPort {
  constructor(private readonly sessions: McpSessions) {}

  async read(source: DescribedSource, reach: Reach): Promise<SourceRead> {
    const server = source.url;

    if (server === null) {
      throw new InconsistentStateError(
        'described source',
        'names an MCP server without its url',
      );
    }

    try {
      const tools = await renewingOnce(
        (token) =>
          this.sessions.tools(server, {
            connection: token?.value ?? null,
            secrets: source.wears.map((each) => each.value),
            credentials: reach.credentials,
          }),
        source.connected ? reach.connection : null,
      );

      return {
        kind: 'read',
        hash: hashOf(source, tools),
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
