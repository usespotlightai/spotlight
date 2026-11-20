import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import { McpServer } from '@configuration/domain/value-objects/mcp-server.vo';
import {
  PERMISSION_DECISIONS,
  type PermissionDecision,
  PermissionRule,
} from '@configuration/domain/value-objects/permission-rule.vo';
import { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';
import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

type RawPermissions = Readonly<Record<PermissionDecision, readonly string[]>>;

export interface RawSettings {
  readonly permissions: RawPermissions;
  readonly mcpServers: readonly {
    readonly name: string;
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
  }[];
  readonly native: Readonly<Record<string, unknown>>;
  readonly secrets: readonly string[];
}

const secretAt = (raw: string, at: number): SecretName => {
  try {
    return SecretName.of(raw);
  } catch (error) {
    if (error instanceof InvalidIdentifierError) {
      throw new InvalidHarnessProfileError(
        ['secrets', at],
        `names secret ${raw}, but a secret name ${error.because}`,
      );
    }

    throw error;
  }
};

export class ProfileSettings {
  private readonly kind = 'profile-settings';

  private constructor(
    readonly rules: readonly PermissionRule[],
    readonly mcpServers: readonly McpServer[],
    readonly native: Readonly<Record<string, unknown>>,
    readonly secrets: readonly SecretName[],
  ) {}

  static fromRaw(settings: RawSettings): ProfileSettings {
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
      secrets: settings.secrets.map((raw, at) => secretAt(raw, at)),
    });
  }

  static of(input: {
    rules: readonly PermissionRule[];
    mcpServers: readonly McpServer[];
    native: Readonly<Record<string, unknown>>;
    secrets: readonly SecretName[];
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

    input.secrets.forEach((secret, at) => {
      if (input.secrets.slice(0, at).some((each) => each.equals(secret))) {
        throw new InvalidHarnessProfileError(
          ['secrets', at],
          `lists secret ${secret.value} twice`,
        );
      }
    });

    return new ProfileSettings(
      Object.freeze([...input.rules]),
      Object.freeze([...input.mcpServers]),
      deepFrozen(
        JSON.parse(JSON.stringify(input.native)) as Record<string, unknown>,
      ),
      Object.freeze([...input.secrets]),
    );
  }

  get permissions(): Record<PermissionDecision, string[]> {
    return {
      allow: this.listed('allow'),
      ask: this.listed('ask'),
      deny: this.listed('deny'),
    };
  }

  get secretReferences(): readonly SecretReference[] {
    return [
      ...this.mcpServers.flatMap((server, at) =>
        server.injectedSecrets.map(({ variable, secret }) =>
          SecretReference.at(
            FieldPath.of(['mcpServers', at, 'env', variable]),
            secret,
          ),
        ),
      ),
      ...this.secrets.map((secret, at) =>
        SecretReference.at(FieldPath.of(['secrets', at]), secret),
      ),
    ];
  }

  uses(secret: SecretName): boolean {
    return this.secretReferences.some((each) => each.isTo(secret));
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
      secrets: this.secrets.map((each) => each.value),
    };
  }
}
