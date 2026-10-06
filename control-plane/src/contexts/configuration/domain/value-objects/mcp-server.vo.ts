import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import { areWords } from '@shared-kernel/domain/value-objects/identifier-shapes';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

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
        'MCP server name must be lowercase words joined by dashes, such as linear',
      );
    }

    if (command.length === 0) {
      throw new InvalidHarnessProfileError(
        ['mcpServers', at, 'command'],
        'MCP server needs a command, such as npx',
      );
    }

    for (const variable of Object.keys(input.env)) {
      if (!ENV_NAME.test(variable)) {
        throw new InvalidHarnessProfileError(
          ['mcpServers', at, 'env', variable],
          'environment variable names must use letters, digits and underscores',
        );
      }
    }

    return new McpServer(name, command, [...input.args], { ...input.env });
  }

  get wornSecrets(): readonly { variable: string; secret: SecretName }[] {
    return Object.entries(this.env).flatMap(([variable, value]) => {
      const secret = SecretName.referencedBy(value);

      return secret ? [{ variable, secret }] : [];
    });
  }
}
