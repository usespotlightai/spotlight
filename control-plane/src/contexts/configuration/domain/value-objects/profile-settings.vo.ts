import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import { McpServer } from '@configuration/domain/value-objects/mcp-server.vo';
import {
  PERMISSION_DECISIONS,
  type PermissionDecision,
  PermissionRule,
} from '@configuration/domain/value-objects/permission-rule.vo';
import type { SecretReferenceAt } from '@configuration/domain/value-objects/secret-reference-at.vo';
import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

type WrittenPermissions = Readonly<
  Record<PermissionDecision, readonly string[]>
>;

export interface WrittenSettings {
  readonly permissions: WrittenPermissions;
  readonly mcpServers: readonly {
    readonly name: string;
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
  }[];
  readonly native: Readonly<Record<string, unknown>>;
}

export class ProfileSettings {
  private readonly kind = 'profile-settings';

  private constructor(
    readonly rules: readonly PermissionRule[],
    readonly mcpServers: readonly McpServer[],
    readonly native: Readonly<Record<string, unknown>>,
  ) {}

  static written(settings: WrittenSettings): ProfileSettings {
    return ProfileSettings.of({
      rules: PERMISSION_DECISIONS.flatMap((decision) =>
        settings.permissions[decision].map((raw, at) =>
          PermissionRule.of(decision, raw, at),
        ),
      ),
      mcpServers: settings.mcpServers.map((server, at) =>
        McpServer.of(server, at),
      ),
      native: settings.native,
    });
  }

  static of(input: {
    rules: readonly PermissionRule[];
    mcpServers: readonly McpServer[];
    native: Readonly<Record<string, unknown>>;
  }): ProfileSettings {
    input.rules.forEach((rule, at) => {
      const earlier = input.rules
        .slice(0, at)
        .find((each) => each.sameAs(rule));

      if (earlier) {
        throw new InvalidHarnessProfileError(
          ['permissions', rule.decision, rule.at],
          earlier.decision === rule.decision
            ? `lists ${rule.written} twice under ${rule.decision}`
            : `lists ${rule.written} under both ${earlier.decision} and ${rule.decision}`,
        );
      }
    });

    input.mcpServers.forEach((server, at) => {
      if (
        input.mcpServers.slice(0, at).some((each) => each.name === server.name)
      ) {
        throw new InvalidHarnessProfileError(
          ['mcpServers', at, 'name'],
          `lists MCP server ${server.name} twice`,
        );
      }
    });

    return new ProfileSettings(
      Object.freeze([...input.rules]),
      Object.freeze([...input.mcpServers]),
      deepFrozen(JSON.parse(JSON.stringify(input.native))),
    );
  }

  get permissions(): Record<PermissionDecision, string[]> {
    return {
      allow: this.listed('allow'),
      ask: this.listed('ask'),
      deny: this.listed('deny'),
    };
  }

  get secretReferences(): readonly SecretReferenceAt[] {
    return this.mcpServers.flatMap((server, at) =>
      server.injectedSecrets.map(({ variable, secret }) => ({
        path: FieldPath.of(['mcpServers', at, 'env', variable]),
        name: secret.value,
      })),
    );
  }

  uses(secret: SecretName): boolean {
    return this.secretReferences.some((each) => each.name === secret.value);
  }

  equals(other: ProfileSettings): boolean {
    return (
      this.kind === other.kind &&
      JSON.stringify(this.snapshot) === JSON.stringify(other.snapshot)
    );
  }

  private listed(decision: PermissionDecision): string[] {
    return this.rules
      .filter((each) => each.decision === decision)
      .map((each) => each.written);
  }

  private get snapshot(): unknown {
    return {
      ...this.permissions,
      mcpServers: this.mcpServers,
      native: this.native,
    };
  }
}
