import { InvalidToolUseError } from '@work/domain/exceptions/invalid-tool-use.error';

export class CalledTool {
  private constructor(
    readonly server: string | null,
    readonly tool: string,
  ) {}

  static of(input: { server: string | null; tool: string }): CalledTool {
    const tool = input.tool.trim();
    const server = input.server?.trim() ?? null;

    if (tool.length === 0) {
      throw new InvalidToolUseError('names each tool it called');
    }
    if (server !== null && server.length === 0) {
      throw new InvalidToolUseError('names the server of each tool it called');
    }

    return new CalledTool(server, tool);
  }
}
