import type { ToolOutput } from '@integrations/application/ports/integration-runtime.port';
import { asJson } from '@integrations/infrastructure/integrations/templating';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

const MAX_SAID = 500;

const plainJson = (output: unknown): ToolOutput =>
  JSON.parse(asJson(output ?? null)) as ToolOutput;

const textOf = (result: CallToolResult): string | null => {
  const [only, ...rest] = result.content;

  return only?.type === 'text' && rest.length === 0 ? only.text : null;
};

const parsedOr = (text: string): ToolOutput => {
  try {
    return plainJson(JSON.parse(text));
  } catch {
    return text;
  }
};

const saidIn = (result: CallToolResult): string =>
  (textOf(result) ?? asJson(result.content)).slice(0, MAX_SAID);

export const mcpOutput = (result: CallToolResult, tool: string): ToolOutput => {
  if (result.isError) {
    throw new UpstreamRefusedError(
      `using ${tool}`,
      `the MCP server answered with an error: ${saidIn(result)}`,
      null,
      false,
    );
  }

  if (result.structuredContent !== undefined) {
    return plainJson(result.structuredContent);
  }

  const text = textOf(result);

  return text === null ? plainJson(result.content) : parsedOr(text);
};
