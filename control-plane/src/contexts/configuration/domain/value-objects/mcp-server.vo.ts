import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import {
  ENVIRONMENT_VARIABLE_NAME_RULE,
  isEnvironmentVariableName,
} from '@shared-kernel/domain/value-objects/environment-variable-name';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

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

    if (!isSlug(name)) {
      throw new InvalidHarnessProfileError(
        ['mcpServers', at, 'name'],
        'MCP server name must be lowercase words joined by dashes, as in linear',
      );
    }

    if (command.length === 0) {
      throw new InvalidHarnessProfileError(
        ['mcpServers', at, 'command'],
        'MCP server needs a command, as in npx',
      );
    }

    for (const variable of Object.keys(input.env)) {
      if (!isEnvironmentVariableName(variable)) {
        throw new InvalidHarnessProfileError(
          ['mcpServers', at, 'env', variable],
          ENVIRONMENT_VARIABLE_NAME_RULE,
        );
      }
    }

    return new McpServer(name, command, [...input.args], { ...input.env });
  }

  get injectedSecrets(): readonly { variable: string; secret: SecretName }[] {
    return Object.entries(this.env).flatMap(([variable, value]) => {
      const secret = SecretName.referencedBy(value);

      return secret ? [{ variable, secret }] : [];
    });
  }
}
