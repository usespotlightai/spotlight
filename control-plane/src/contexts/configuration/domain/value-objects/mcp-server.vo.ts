import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import { areWords } from '@shared-kernel/domain/value-objects/identifier-shapes';

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class McpServer {
  private constructor(
    readonly name: string,
    readonly command: string,
    readonly args: readonly string[],
    readonly env: Readonly<Record<string, string>>,
  ) {}

  static of(
    input: {
      name: string;
      command: string;
      args: readonly string[];
      env: Readonly<Record<string, string>>;
    },
    at: number,
  ): McpServer {
    const name = input.name.trim();
    const command = input.command.trim();

    if (!areWords(name)) {
      throw new InvalidHarnessProfileError(
        ['mcpServers', at, 'name'],
        'names an MCP server in lower case words joined by dashes, as in linear',
      );
    }

    if (command.length === 0) {
      throw new InvalidHarnessProfileError(
        ['mcpServers', at, 'command'],
        'starts an MCP server with a command, as in npx',
      );
    }

    for (const variable of Object.keys(input.env)) {
      if (!ENV_NAME.test(variable)) {
        throw new InvalidHarnessProfileError(
          ['mcpServers', at, 'env', variable],
          'names an environment variable in letters, digits and underscores',
        );
      }
    }

    return new McpServer(name, command, [...input.args], { ...input.env });
  }
}
